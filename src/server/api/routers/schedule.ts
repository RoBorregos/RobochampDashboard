import { z } from "zod";
import { Role, ScheduleStatus } from "@prisma/client";
import { createTRPCRouter, judgeProcedure, publicProcedure } from "../trpc";
import { db } from "~/server/db";

type Row = {
  id: string;
  time: Date;
  team: string;
  track: string;
  status: ScheduleStatus;
  points: number | null;
};

// shortcut: per-instance memory cache; on serverless each instance has its own,
// still caps DB load at ~1 board query per instance per TTL. Use Redis if that's not enough.
const TTL_MS = 5000;
let cache: { at: number; rows: Row[] } | null = null;

const score = { teamId: true, roundId: true, points: true } as const;

const trackOf = (name: string) =>
  /(?:pista|track)\s*([a-c])/i.exec(name)?.[1]?.toUpperCase() ?? "?";

async function loadRows(): Promise<Row[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;

  const [challenges, a, b, c] = await Promise.all([
    db.challenge.findMany({
      where: { round: { isVisible: true, team: { isActive: true } } },
      select: {
        id: true,
        name: true,
        time: true,
        status: true,
        round: { select: { number: true, team: { select: { id: true, name: true } } } },
      },
      orderBy: { time: "asc" },
    }),
    // latest score first, so the first hit per team+round wins below
    db.challengeA.findMany({ select: score, orderBy: { createdAt: "desc" } }),
    db.challengeB.findMany({ select: score, orderBy: { createdAt: "desc" } }),
    db.challengeC.findMany({ select: score, orderBy: { createdAt: "desc" } }),
  ]);

  // judge forms store roundId as the round number string
  const points = new Map<string, number>();
  for (const [track, list] of [["A", a], ["B", b], ["C", c]] as const)
    for (const s of list) {
      const k = `${track}|${s.teamId}|${s.roundId}`;
      if (!points.has(k)) points.set(k, s.points);
    }

  const rows: Row[] = [];
  for (const ch of challenges) {
    const team = ch.round.team;
    if (!team) continue;
    const track = trackOf(ch.name);
    const pts = points.get(`${track}|${team.id}|${ch.round.number}`) ?? null;
    rows.push({
      id: ch.id,
      time: ch.time,
      team: team.name,
      track,
      // a recorded score means the run is over, unless explicitly cancelled
      status:
        pts !== null && ch.status !== ScheduleStatus.CANCELLED
          ? ScheduleStatus.FINALIZED
          : ch.status,
      points: pts,
    });
  }
  cache = { at: Date.now(), rows };
  return rows;
}

export const scheduleRouter = createTRPCRouter({
  board: publicProcedure.query(async ({ ctx }) => ({
    rows: await loadRows(),
    canEdit: ctx.session?.user.role === Role.ADMIN || ctx.session?.user.role === Role.JUDGE,
  })),

  setStatus: judgeProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(ScheduleStatus) }))
    .mutation(async ({ input }) => {
      await db.challenge.update({
        where: { id: input.id },
        data: { status: input.status },
      });
      cache = null;
    }),
});
