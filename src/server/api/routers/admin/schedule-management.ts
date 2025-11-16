import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { parse } from "csv-parse";
import fs from "fs";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

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
                  { name: "Pista A", time: ComputeDate({ date: row[1] }) },
                  { name: "Pista B", time: ComputeDate({ date: row[2] }) },
                  { name: "Pista C", time: ComputeDate({ date: row[3] }) },
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
                  { name: "Pista A", time: ComputeDate({ date: row[4] }) },
                  { name: "Pista B", time: ComputeDate({ date: row[5] }) },
                  { name: "Pista C", time: ComputeDate({ date: row[6] }) },
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
                  { name: "Pista A", time: ComputeDate({ date: row[7] }) },
                  { name: "Pista B", time: ComputeDate({ date: row[8] }) },
                  { name: "Pista C", time: ComputeDate({ date: row[9] }) },
                ],
              },
            },
          });
        }
      })();
    });

    return "Finished";
  }),

  regenerateSchedules: adminProcedure
    .input(
      z.object({
        round1StartTime: z.string().default("08:30"),
        round2StartTime: z.string().default("12:30"),
        round3StartTime: z.string().default("16:30"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activeTeams = await ctx.db.team.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });

      if (activeTeams.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active teams found",
        });
      }

      const { round1StartTime, round2StartTime, round3StartTime } = input;
      const startTimes = [round1StartTime, round2StartTime, round3StartTime];
      const pistaNames = ["Pista A", "Pista B"];
      const challengeNames = ["Challenge 1", "Challenge 2", "Challenge 3"];

      for (const team of activeTeams) {
        await ctx.db.round.deleteMany({
          where: { teamId: team.id },
        });
      }

      for (let round = 1; round <= 3; round++) {
        const startTime = startTimes[round - 1];
        if (!startTime) continue;

        const [startHour, startMinute] = startTime.split(":").map(Number);
        const baseStartMinutes = (startHour ?? 8) * 60 + (startMinute ?? 30);

        // For each round we'll schedule teams into 7-minute slots across 2 pistas.
        // Each team gets exactly one slot per round (either Pista A or Pista B).
        const totalTimeSlots = Math.ceil(activeTeams.length / 2);
        let currentSlotMinutes = baseStartMinutes;

        for (let slotIndex = 0; slotIndex < totalTimeSlots; slotIndex++) {
          const hour = Math.floor(currentSlotMinutes / 60);
          const minute = currentSlotMinutes % 60;
          const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

          // Assign up to 2 teams for this time slot (one per pista)
          for (let pistaIndex = 0; pistaIndex < 2; pistaIndex++) {
            const teamIndex = slotIndex * 2 + pistaIndex;
            if (teamIndex >= activeTeams.length) break;

            const team = activeTeams[teamIndex];
            if (!team) continue;

            // Determine pista assignment for this team in this round.
            // pistaIndex is the position in the slot; shift by round to rotate between rounds.
            const pistaAssignment = (pistaIndex + (round - 1)) % 2;
            const pistaName = pistaNames[pistaAssignment];

            let roundRecord = await ctx.db.round.findFirst({
              where: { teamId: team.id, number: round },
            });

            if (!roundRecord) {
              roundRecord = await ctx.db.round.create({
                data: {
                  teamId: team.id,
                  number: round,
                  isVisible: false,
                },
              });
            }

            // Create single challenge entry for this round (one pass per team per round)
            await ctx.db.challenge.create({
              data: {
                roundId: roundRecord.id,
                name: `${pistaName}`,
                time: ComputeDate({ date: timeString }),
              },
            });
          }

          // Move to next 7-minute slot
          currentSlotMinutes += 7;
        }
      }

      return {
        success: true,
        teamsScheduled: activeTeams.length,
        tablesGenerated: 9, // 3 rounds × 3 challenges (we present 3 challenge tables per round)
      };
    }),

  // Generate schedules for a single specific round only
  generateSingleRound: adminProcedure
    .input(
      z.object({
        roundNumber: z.number().min(1).max(3),
        startTime: z.string().default("08:30"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activeTeams = await ctx.db.team.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });

      if (activeTeams.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active teams found",
        });
      }

      const { roundNumber, startTime } = input;
      // Use 2 tracks (A, B). Each slot is 7 minutes (1 minute calibration + 6 minutes run).
      const pistaNames = ["Pista A", "Pista B"];
      const challengeNames = ["Challenge 1", "Challenge 2", "Challenge 3"];

      console.log(
        `Generating single round ${roundNumber} starting at ${startTime}`,
      );

      // Delete existing data for this specific round only
      for (const team of activeTeams) {
        await ctx.db.round.deleteMany({
          where: { teamId: team.id, number: roundNumber },
        });
      }

      const [startHour, startMinute] = startTime.split(":").map(Number);
      const baseStartMinutes = (startHour ?? 8) * 60 + (startMinute ?? 30);

      console.log(
        `Round ${roundNumber}: startTime=${startTime}, parsed=${startHour}:${startMinute}, baseStartMinutes=${baseStartMinutes}`,
      );

      // For a single round generation we schedule one slot per team in 7-minute increments
      // across 2 pistas. Each team gets exactly one challenge entry for this round.
      const totalTimeSlots = Math.ceil(activeTeams.length / 2);
      let currentSlotMinutes = baseStartMinutes;

      for (let slotIndex = 0; slotIndex < totalTimeSlots; slotIndex++) {
        const hour = Math.floor(currentSlotMinutes / 60);
        const minute = currentSlotMinutes % 60;
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

        for (let pistaIndex = 0; pistaIndex < 2; pistaIndex++) {
          const teamIndex = slotIndex * 2 + pistaIndex;
          if (teamIndex >= activeTeams.length) break;

          const team = activeTeams[teamIndex];
          if (!team) continue;

          const pistaAssignment = (pistaIndex + (roundNumber - 1)) % 2;
          const pistaName = pistaNames[pistaAssignment];

          let roundRecord = await ctx.db.round.findFirst({
            where: { teamId: team.id, number: roundNumber },
          });

          if (!roundRecord) {
            roundRecord = await ctx.db.round.create({
              data: { teamId: team.id, number: roundNumber, isVisible: false },
            });
          }

          await ctx.db.challenge.create({
            data: {
              roundId: roundRecord.id,
              name: `${pistaName}`,
              time: ComputeDate({ date: timeString }),
            },
          });
        }

        currentSlotMinutes += 7;
      }

      return {
        success: true,
        roundNumber,
        teamsScheduled: activeTeams.length,
        tablesGenerated: 1, // one table for this round
        startTime,
      };
    }),

  getScheduleTables: adminProcedure.query(async ({ ctx }) => {
    const activeTeams = await ctx.db.team.findMany({
      where: { isActive: true },
      include: {
        rounds: {
          include: {
            challenges: true,
          },
          orderBy: { number: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const tables = [];

    // Generate 3 table structures (one per round). Each table shows times for Pista A and Pista B.
    for (let round = 1; round <= 3; round++) {
      const timeMap = new Map<string, { pistaA: string; pistaB: string }>();

      for (const team of activeTeams) {
        const roundData = team.rounds.find((r) => r.number === round);
        if (!roundData) continue;

        // Each team should have a single challenge entry for this round
        for (const challenge of roundData.challenges ?? []) {
          const timeKey = challenge.time.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
          });

          if (!timeMap.has(timeKey)) {
            timeMap.set(timeKey, { pistaA: "", pistaB: "" });
          }

          const entry = timeMap.get(timeKey)!;

          if (String(challenge.name).includes("Pista A")) {
            entry.pistaA = team.name;
          } else if (String(challenge.name).includes("Pista B")) {
            entry.pistaB = team.name;
          }
        }
      }

      // Convert to sorted array
      const sortedTimes = Array.from(timeMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, pistas]) => ({
          time,
          ...pistas,
        }));

      tables.push({
        round,
        challenge: 1,
        challengeName: "Slot",
        timeSlots: sortedTimes,
      });
    }

    return tables;
  }),
});
