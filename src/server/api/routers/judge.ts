import { z } from "zod";

import { createTRPCRouter, judgeProcedure as baseJudgeProcedure } from "rbrgs/server/api/trpc";
import { JudgeColor, type Prisma, type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { applyLive, emptyLive, liveOpSchema, type LiveState } from "rbrgs/lib/liveRun";
import { invalidateSchedule, trackOf } from "./schedule";
import {
  challengeASchema,
  challengeBSchema,
  challengeCSchema,
  marsSchema,
} from "rbrgs/lib/schemas";
import { computeMarsPoints } from "rbrgs/lib/marsScoring";
import { env } from "rbrgs/env";
import { LIVE_CHANNEL } from "rbrgs/lib/liveRun";

const realtime = env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Tells the run's judges to refetch it (see useLiveRun). Awaited: a serverless function may freeze once it responds.
const pingLive = async (key: string) => {
  if (!realtime) return;
  await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages: [{ topic: LIVE_CHANNEL, event: "ping", payload: { key } }] }),
  }).catch((e) => console.error("realtime ping failed", e)); // judges still refetch every 30s
};

// Any judge write (score create/delete) may change the public schedule board.
const judgeProcedure = baseJudgeProcedure.use(async ({ next }) => {
  const result = await next();
  invalidateSchedule();
  return result;
});

// Every judge on a run polls it twice a second: serve those from memory so the DB sees
// at most one read per run per LIVE_TTL_MS. Writes still go through the DB (version check).
// shortcut: per server instance; with several instances each one reads on its own, upgrade to push (Supabase Realtime) if that's too much.
const LIVE_TTL_MS = 400;
const liveCache = new Map<string, { at: number; live: Promise<LiveState> }>();
const readLive = (db: PrismaClient, key: string) =>
  db.liveRun
    .findUnique({ where: { key } })
    .then((row) => (row?.data as unknown as LiveState) ?? emptyLive);
const cachedLive = (db: Parameters<typeof readLive>[0], key: string) => {
  // With pings, reads only follow a write: a stale cache on another server instance would stick.
  if (realtime) return readLive(db, key);
  const hit = liveCache.get(key);
  if (hit && Date.now() - hit.at < LIVE_TTL_MS) return hit.live;
  // Cache the promise, so polls arriving together share one query.
  const live = readLive(db, key).catch((e) => {
    liveCache.delete(key);
    throw e;
  });
  liveCache.set(key, { at: Date.now(), live });
  return live;
};

const computePointsLOP = (_lackOfProgress: number) => {
  return 0;
};

export const judgeRouter = createTRPCRouter({
  me: baseJudgeProcedure.query(({ ctx }) =>
    ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: { judgeColor: true, judgeTrack: true },
    }),
  ),

  // Every scheduled run of the active teams plus the server clock, so the
  // judge's page can follow the schedule without trusting the device clock.
  lineup: baseJudgeProcedure.query(async ({ ctx }) => {
    const rounds = await ctx.db.round.findMany({
      where: { team: { isActive: true } },
      select: {
        number: true,
        team: { select: { id: true, name: true, category: true } },
        challenges: { select: { name: true, time: true } },
      },
    });
    const runs = rounds.flatMap((r) =>
      r.team
        ? r.challenges.map((c) => ({
            teamId: r.team!.id,
            teamName: r.team!.name,
            category: r.team!.category,
            round: r.number,
            track: trackOf(c.name),
            start: c.time,
          }))
        : [],
    );
    return { serverNow: new Date(), runs };
  }),

  setColor: baseJudgeProcedure
    .input(z.object({ color: z.nativeEnum(JudgeColor) }))
    .mutation(({ ctx, input }) =>
      ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { judgeColor: input.color },
        select: { id: true },
      }),
    ),

  setTrack: baseJudgeProcedure
    .input(z.object({ track: z.enum(["A", "B"]) }))
    .mutation(({ ctx, input }) =>
      ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { judgeTrack: input.track },
        select: { id: true },
      }),
    ),

  // Shared state of one run, polled by every judge watching it.
  live: baseJudgeProcedure
    .input(z.object({ key: z.string().max(100) }))
    .query(async ({ ctx, input }) => {
      return { serverNow: Date.now(), live: await cachedLive(ctx.db, input.key) };
    }),

  // One judge's tap. ok: false when refused (locked by another judge or stale): the
  // returned state is the truth to show.
  liveSet: baseJudgeProcedure
    .input(z.object({ key: z.string().max(100), from: z.unknown() }).and(liveOpSchema))
    .mutation(async ({ ctx, input }) => {
      // Optimistic concurrency on `version`: retry when another judge wrote in between.
      for (let i = 0; i < 5; i++) {
        const row = await ctx.db.liveRun.findUnique({ where: { key: input.key } });
        const live = (row?.data as unknown as LiveState) ?? emptyLive;
        const now = Date.now();
        const next = applyLive(live, input, ctx.session.user.id, now);
        const cache = (l: LiveState) => liveCache.set(input.key, { at: Date.now(), live: Promise.resolve(l) });
        if (!next) {
          cache(live);
          return { ok: false, serverNow: now, live };
        }
        const data = next as unknown as Prisma.InputJsonValue;
        const saved = row
          ? (await ctx.db.liveRun.updateMany({
              where: { key: input.key, version: row.version },
              data: { data, version: { increment: 1 } },
            })).count > 0
          : await ctx.db.liveRun.create({ data: { key: input.key, data } }).then(() => true, () => false);
        if (saved) {
          cache(next);
          await pingLive(input.key);
          return { ok: true, serverNow: now, live: next };
        }
      }
      throw new TRPCError({ code: "CONFLICT", message: "Too many judges at once, try again." });
    }),

  roundMars: judgeProcedure
    .input(marsSchema)
    .mutation(async ({ ctx, input }) => {
      const { genericFormSchema: g, ...run } = input;
      const data = {
        ...run,
        lackOfProgress: g.lackOfProgress,
        roundTimeSeconds: g.roundTimeSeconds,
        roundId: g.roundId ?? "",
        teamId: g.teamId,
        judgeID: ctx.session.user.id,
        points: computeMarsPoints(run.category, run, g.roundTimeSeconds),
      };
      if (!g.roundId) return await ctx.db.marsRun.create({ data });
      // A scheduled run has one result: every judge on it auto-finalizes at the same
      // moment, so the later submit updates the first instead of doubling it.
      return await ctx.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mars:${g.teamId}:${g.roundId}`}))`;
        const existing = await tx.marsRun.findFirst({
          where: { teamId: g.teamId, roundId: g.roundId },
          select: { id: true },
        });
        return existing
          ? await tx.marsRun.update({ where: { id: existing.id }, data })
          : await tx.marsRun.create({ data });
      });
    }),

  roundMarsDelete: judgeProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.marsRun.delete({ where: { id: input.id } });
    }),

  roundA: judgeProcedure
    .input(challengeASchema)
    .mutation(async ({ ctx, input }) => {
      const red = input.redCubes ?? 0;
      const green = input.greenCubes ?? 0;
      const blue = input.blueCubes ?? 0;
      const yellow = input.yellowCubes ?? 0;
      const seesaw = input.seesawCrossings ?? 0;
      const cables = input.cablesCut ?? 0;
      const incorrect = input.incorrectCut ?? false;

      let points = 0;

      let zoneAPoints = 0;
      zoneAPoints += red * 10;
      zoneAPoints += green * 10;
      zoneAPoints += blue * 10;
      zoneAPoints += yellow * 35;
      zoneAPoints += seesaw * 25;
      if (zoneAPoints > 120) zoneAPoints = 120;

      let zoneBPoints = cables * 20;
      if (zoneBPoints > 80) zoneBPoints = 80;

      points += zoneAPoints + zoneBPoints;

      const roundTime = input.genericFormSchema.roundTimeSeconds ?? 0;
      if (zoneAPoints === 120 && zoneBPoints === 80) {
        const secondsRemaining = Math.max(0, 300 - roundTime);
        points += secondsRemaining;
      }

      points += computePointsLOP(input.genericFormSchema.lackOfProgress);

      return await ctx.db.challengeA.create({
        data: {
          finishedTrack: input.finishedTrack,
          obtainedBonus: input.genericFormSchema.obtainedBonus,
          roundTimeSeconds: input.genericFormSchema.roundTimeSeconds,
          lackOfProgress: input.genericFormSchema.lackOfProgress,
          roundId: input.genericFormSchema.roundId ?? "",
          teamId: input.genericFormSchema.teamId,
          judgeID: ctx.session.user.id,
          points: points,
          redCubes: red,
          greenCubes: green,
          blueCubes: blue,
          yellowCubes: yellow,
          seesawCrossings: seesaw,
          cablesCut: cables,
          incorrectCut: incorrect,
        },
      });
    }),

  roundB: judgeProcedure
    .input(challengeBSchema)
    .mutation(async ({ ctx, input }) => {
      let points = 0;
      points += input.trackData.trackPoints;
      points += computePointsLOP(input.genericFormSchema.lackOfProgress);

      return await ctx.db.challengeB.create({
        data: {
          trackPoints: input.trackData.trackPoints,
          patternsPassed: input.trackData.patternsPassed,
          lackOfProgress: input.genericFormSchema.lackOfProgress,
          points: points,
          roundTimeSeconds: input.genericFormSchema.roundTimeSeconds,
          teamId: input.genericFormSchema.teamId,
          judgeID: ctx.session.user.id,
          roundId: input.genericFormSchema.roundId ?? "",
        },
      });
    }),

  roundC: judgeProcedure
    .input(challengeCSchema)
    .mutation(async ({ ctx, input }) => {
      let points = 0;
      points += input.detectedColors * 3;
      points += input.passedObstacles * 8;
      points += input.finishedTrack ? 35 : 0;
      points += input.genericFormSchema.obtainedBonus ? 41 : 0;

      points += input.passedRamp ? 10 : 0;
      points += input.crossedRampWithoutLOP ? 10 : 0;
      points += input.reverseRamp ? 40 : 0;
      points += input.crossedRampWithoutTouching ? 20 : 0;
      points += computePointsLOP(input.genericFormSchema.lackOfProgress);

      return await ctx.db.challengeC.create({
        data: {
          detectedColors: input.detectedColors,
          finishedTrack: input.finishedTrack,
          obtainedBonus: input.genericFormSchema.obtainedBonus,

          passedObstacles: input.passedObstacles,
          passedRamp: input.passedRamp,
          crossedRampWithoutLOP: input.crossedRampWithoutLOP,
          crossedRampWithoutTouching: input.crossedRampWithoutTouching,
          reverseRamp: input.reverseRamp,

          lackOfProgress: input.genericFormSchema.lackOfProgress,
          points: points,
          roundTimeSeconds: input.genericFormSchema.roundTimeSeconds,
          teamId: input.genericFormSchema.teamId,
          judgeID: ctx.session.user.id,
          roundId: input.genericFormSchema.roundId ?? "",
        },
      });
    }),

  getTeamIds: judgeProcedure.query(async ({ ctx }) => {
    const team = await ctx.db.team.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    return team;
  }),
  roundADelete: judgeProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.challengeA.delete({
        where: {
          id: input.id,
        },
      });
    }),
  roundBDelete: judgeProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.challengeB.delete({
        where: {
          id: input.id,
        },
      });
    }),
  roundCDelete: judgeProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.challengeC.delete({
        where: {
          id: input.id,
        },
      });
    }),
});
