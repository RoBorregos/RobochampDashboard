import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";

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

export const testingUtilitiesRouter = createTRPCRouter({
  // Test case endpoint - creates sample teams and generates schedules
  runTestCase: adminProcedure.mutation(async ({ ctx }) => {
    // Clear existing test data
    await ctx.db.challenge.deleteMany({});
    await ctx.db.round.deleteMany({});
    await ctx.db.team.deleteMany({
      where: {
        name: {
          in: [
            "Test Team A",
            "Test Team B",
            "Test Team C",
            "Test Team D",
            "Test Team E",
            "Test Team F",
          ],
        },
      },
    });

    // Create 6 test teams
    const testTeams = [];
    const teamNames = [
      "Test Team A",
      "Test Team B",
      "Test Team C",
      "Test Team D",
      "Test Team E",
      "Test Team F",
    ];

    for (const name of teamNames) {
      const team = await ctx.db.team.create({
        data: {
          name,
          isActive: true,
        },
      });
      testTeams.push(team);
    }

    // Generate schedules with test times
    const startTimes = ["08:30", "12:30", "16:30"];
    const pistaNames = ["Pista A", "Pista B", "Pista C"];
    const challengeNames = ["Challenge 1", "Challenge 2", "Challenge 3"];

    // Generate 9 tables: 3 rounds × 3 challenges per round
    for (let round = 1; round <= 3; round++) {
      const startTime = startTimes[round - 1];
      if (!startTime) continue;

      const [startHour, startMinute] = startTime.split(":").map(Number);
      const baseStartMinutes = (startHour ?? 8) * 60 + (startMinute ?? 30);

      // Create 3 challenges for this round
      for (let challengeIndex = 0; challengeIndex < 3; challengeIndex++) {
        const challengeName = challengeNames[challengeIndex];
        if (!challengeName) continue;

        const timePerChallenge = Math.ceil(testTeams.length / 3) * 6;
        const breakBetweenChallenges = 1;

        const challengeStartMinutes =
          challengeIndex === 0
            ? baseStartMinutes
            : baseStartMinutes +
              challengeIndex * (timePerChallenge + breakBetweenChallenges);

        let currentSlotMinutes = challengeStartMinutes;
        const totalTimeSlots = Math.ceil(testTeams.length / 3);

        for (let slotIndex = 0; slotIndex < totalTimeSlots; slotIndex++) {
          const hour = Math.floor(currentSlotMinutes / 60);
          const minute = currentSlotMinutes % 60;
          const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

          for (let pistaIndex = 0; pistaIndex < 3; pistaIndex++) {
            const teamIndex = slotIndex * 3 + pistaIndex;
            if (teamIndex >= testTeams.length) break;

            const team = testTeams[teamIndex];
            if (!team) continue;

            const teamBasePista = teamIndex % 3;
            const roundStartPista = (teamBasePista + (round - 1)) % 3;
            const finalPistaIndex = (roundStartPista + challengeIndex) % 3;
            const pistaName = pistaNames[finalPistaIndex];
            if (!pistaName) continue;

            let roundRecord = await ctx.db.round.findFirst({
              where: { teamId: team.id, number: round },
            });

            roundRecord ??= await ctx.db.round.create({
              data: {
                teamId: team.id,
                number: round,
                isVisible: false,
              },
            });

            await ctx.db.challenge.create({
              data: {
                roundId: roundRecord.id,
                name: `${challengeName} - ${pistaName}`,
                time: ComputeDate({ date: timeString }),
              },
            });
          }

          currentSlotMinutes += 6;
        }
      }
    }

    return {
      success: true,
      message: "Test case executed successfully!",
      teamsCreated: testTeams.length,
      tablesGenerated: 9,
      rotationPattern:
        "Each team follows systematic pista rotation across rounds",
    };
  }),

  debugTeamSchedules: adminProcedure.query(async ({ ctx }) => {
    const teams = await ctx.db.team.findMany({
      include: {
        members: {
          select: {
            id: true,
            name: true,
            email: true,
            interviewTime: true,
            interviewArea: true,
          },
        },
        rounds: {
          where: { isVisible: true },
          include: { challenges: true },
          orderBy: { number: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return teams.map((team) => ({
      name: team.name,
      members: team.members,
      rounds: team.rounds.map((round) => ({
        number: round.number,
        challenges: round.challenges.map((challenge) => ({
          name: challenge.name,
          time: challenge.time,
          timeString: challenge.time.toISOString(),
        })),
      })),
    }));
  }),
});
