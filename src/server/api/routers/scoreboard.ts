type TeamScores = {
  teamId: string;
  teamName: string;
  // rounds will store a single-score object per round: { score: number }
  rounds: Record<number, { score: number }>;
  // total is the accumulated sum of all rounds' scores
  total: number;
};

import { Role } from "@prisma/client";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { Round } from "rbrgs/lib/round";

export const scoreboardRouter = createTRPCRouter({
  getScoreboard: publicProcedure.query(async ({ ctx }) => {
    // Check if scoreboard frozen
    const config = await ctx.db.config.findFirst();
    const isAdmin = ctx.session?.user.role == Role.ADMIN;
    let isFrozen = config?.freeze ?? false;
    if (isAdmin) {
      isFrozen = false;
    }

    // Fetch all teams
    const teams = await ctx.db.team.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    // Fetch only challenge A (we're using a single-challenge system)
    const challengesA = await ctx.db.challengeA.findMany();

    // Group challengesA by team
    const challengesByTeam: Record<string, typeof challengesA> = {};
    for (const ch of challengesA) {
      if (!challengesByTeam[ch.teamId]) challengesByTeam[ch.teamId] = [];
      challengesByTeam[ch.teamId].push(ch);
    }

    // Process scores for each team using only challengeA points
    const teamScores: TeamScores[] = teams.map((team) => {
      const scores: TeamScores = {
        teamId: team.id,
        teamName: team.name,
        rounds: {},
        total: 0,
      };

      const teamChallenges = challengesByTeam[team.id] ?? [];

      // Fill rounds from actual challengeA entries (no fixed round list)
      for (const ch of teamChallenges) {
        const roundId = Number(ch.roundId);
        if (isNaN(roundId)) continue;
        const isRoundC = (roundId as Round) === Round.C;
        const points = isRoundC && isFrozen ? 0 : ch.points;
        scores.rounds[roundId] = { score: points };
      }

      // Calculate accumulated total as straight sum of all round scores
      scores.total = Object.values(scores.rounds).reduce((sum, r) => sum + (r.score ?? 0), 0);

      return scores;
    });

    // Sort by accumulated total descending
    return teamScores.sort((a, b) => b.total - a.total);
  }),
});
