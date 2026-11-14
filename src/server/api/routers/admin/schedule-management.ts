import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { parse } from "csv-parse";
import fs from "fs";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invalidateSchedule } from "../schedule";
import { syncSchedule } from "rbrgs/lib/bracketSchedule";

// Helper function to compute date from time string
const ComputeDate = ({ date }: { date: string | undefined }) => {
  if (date === undefined) {
    const inv = new Date();
    inv.setHours(0);
    inv.setMinutes(0);
    return inv;
  }

  const timeParts = date.split(":");
  const hour = parseInt(timeParts[0] ?? "0");
  const minute = timeParts[1];

  const d = new Date();
  d.setHours(hour);
  d.setMinutes(parseInt(minute ?? "0"));
  return d;
};

type Cell = {
  id: string;
  team: string;
  time: string;
  initialTime: string;
  status: string;
};

const hhmm = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

export const scheduleManagementRouter = createTRPCRouter({
  // Existing uploadTeamData procedure
  uploadTeamData: adminProcedure.mutation(async ({ ctx }) => {
    const records: string[][] = [];
    const parser = parse({
      delimiter: ",",
    });
    parser.on("readable", function () {
      let record: unknown;
      while ((record = parser.read() as unknown)) {
        const typedRecord = record as string[];
        console.log(typedRecord);
        if (typedRecord[0] === "Nombre") {
          continue;
        }
        records.push(typedRecord);
      }
    });
    // R1_PistaA,R1_PistaB,R1_PistaC,R2_PistaA,R2_PistaB,R2_PistaC,R3_PistaA,R3_PistaB,R3_PistaC
    const filePath = "public/schedule.csv";

    fs.createReadStream(filePath).pipe(parser);

    parser.on("end", function () {
      void (async () => {
        for (const row of records) {
          const teamObject = await ctx.db.team.findFirst({
            where: {
              name: row[0]?.trim() ?? "",
            },
          });

          await ctx.db.round.deleteMany({
            where: {
              teamId: teamObject?.id,
            },
          });

          await ctx.db.round.create({
            data: {
              teamId: teamObject?.id,
              number: 1,
              challenges: {
                create: [
                  { name: "Pista A", time: ComputeDate({ date: row[1] }), initialTime: ComputeDate({ date: row[1] }) },
                  { name: "Pista B", time: ComputeDate({ date: row[2] }), initialTime: ComputeDate({ date: row[2] }) },
                  { name: "Pista C", time: ComputeDate({ date: row[3] }), initialTime: ComputeDate({ date: row[3] }) },
                ],
              },
            },
          });

          await ctx.db.round.create({
            data: {
              teamId: teamObject?.id,
              number: 2,
              challenges: {
                create: [
                  { name: "Pista A", time: ComputeDate({ date: row[4] }), initialTime: ComputeDate({ date: row[4] }) },
                  { name: "Pista B", time: ComputeDate({ date: row[5] }), initialTime: ComputeDate({ date: row[5] }) },
                  { name: "Pista C", time: ComputeDate({ date: row[6] }), initialTime: ComputeDate({ date: row[6] }) },
                ],
              },
            },
          });
          await ctx.db.round.create({
            data: {
              teamId: teamObject?.id,
              number: 3,
              challenges: {
                create: [
                  { name: "Pista A", time: ComputeDate({ date: row[7] }), initialTime: ComputeDate({ date: row[7] }) },
                  { name: "Pista B", time: ComputeDate({ date: row[8] }), initialTime: ComputeDate({ date: row[8] }) },
                  { name: "Pista C", time: ComputeDate({ date: row[9] }), initialTime: ComputeDate({ date: row[9] }) },
                ],
              },
            },
          });
        }
      })();
    });

    return "Finished";
  }),

  // Rebuilds both categories' schedules from their saved brackets.
  generateFromBrackets: adminProcedure.mutation(async ({ ctx }) => {
    const brackets = await ctx.db.bracket.findMany();
    if (brackets.length === 0)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Save a bracket first" });
    let runs = 0;
    const warnings: string[] = [];
    for (const b of brackets) {
      const groups = (b.data as { groups?: string[][] }).groups ?? [];
      const r = await syncSchedule(ctx.db, b.category, groups);
      runs += r.runs;
      warnings.push(...r.warnings);
    }
    invalidateSchedule();
    return { runs, warnings };
  }),

  // Edit one run's time, keeping the first scheduled time for comparison.
  updateChallengeTime: adminProcedure
    .input(z.object({ id: z.string(), time: z.string().regex(/^\d{2}:\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      const ch = await ctx.db.challenge.findUnique({ where: { id: input.id } });
      if (!ch) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.challenge.update({
        where: { id: input.id },
        data: {
          initialTime: ch.initialTime ?? ch.time,
          time: ComputeDate({ date: input.time }),
        },
      });
      invalidateSchedule();
    }),

  // One table per category and round: a row per start time, one cell per track.
  getScheduleTables: adminProcedure.query(async ({ ctx }) => {
    const challenges = await ctx.db.challenge.findMany({
      where: { round: { team: { category: { not: null } } } },
      include: { round: { select: { number: true, team: { select: { name: true, category: true } } } } },
      orderBy: { time: "asc" },
    });
    const tables = new Map<string, { category: string; round: number; rows: Map<string, Record<"pistaA" | "pistaB", Cell | null>> }>();
    for (const c of challenges) {
      const team = c.round.team;
      if (!team?.category) continue;
      const key = `${team.category}${c.round.number}`;
      const t = tables.get(key) ?? { category: team.category, round: c.round.number, rows: new Map() };
      tables.set(key, t);
      const time = hhmm(c.time);
      const row = t.rows.get(time) ?? { pistaA: null, pistaB: null };
      t.rows.set(time, row);
      row[c.name.includes("B") ? "pistaB" : "pistaA"] = {
        id: c.id,
        team: team.name,
        time,
        initialTime: hhmm(c.initialTime ?? c.time),
        status: c.status,
      };
    }
    return [...tables.values()].map((t) => ({
      category: t.category,
      round: t.round,
      slots: [...t.rows.entries()].map(([time, r]) => ({ time, ...r })),
    }));
  }),
});
