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

    // Fetch challenges from all challenge tables and merge them. Some
    // setups store points in ChallengeA/B/C; aggregate all so accumulated
    // totals are correct.
    const [challengesA, challengesB, challengesC] = await Promise.all([
      ctx.db.challengeA.findMany(),
      ctx.db.challengeB.findMany(),
      ctx.db.challengeC.findMany(),
    ]);

    type AnyChallenge = {
      teamId: string;
      roundId: string;
      points: number;
      createdAt: Date;
    };
    const allChallenges: AnyChallenge[] = [];

    for (const ch of challengesA) {
      allChallenges.push({
        teamId: ch.teamId,
        roundId: ch.roundId,
        points: ch.points,
        createdAt: ch.createdAt,
      });
    }
    for (const ch of challengesB) {
      allChallenges.push({
        teamId: ch.teamId,
        roundId: ch.roundId,
        points: ch.points,
        createdAt: ch.createdAt,
      });
    }
    for (const ch of challengesC) {
      allChallenges.push({
        teamId: ch.teamId,
        roundId: ch.roundId,
        points: ch.points,
        createdAt: ch.createdAt,
      });
    }

    // Group by team for faster lookup
    const challengesByTeam: Record<string, AnyChallenge[]> = {};
    for (const ch of allChallenges) {
      const list =
        challengesByTeam[ch.teamId] ?? (challengesByTeam[ch.teamId] = []);
      list.push(ch);
    }

    // Process scores for each team using aggregated points
    const teamScores: TeamScores[] = teams.map((team) => {
      const scores: TeamScores = {
        teamId: team.id,
        teamName: team.name,
        rounds: {},
        total: 0,
      };

      const teamChallenges = challengesByTeam[team.id] ?? [];

      // Fill rounds from actual challenge entries. If multiple challenge
      // entries exist for the same round, sum their points.
      for (const ch of teamChallenges) {
        const roundId = Number(ch.roundId);
        if (isNaN(roundId)) continue;
        const isRoundC = (roundId as Round) === Round.C;
        const points = isRoundC && isFrozen ? 0 : ch.points;
        const existing = scores.rounds[roundId]?.score ?? 0;
        scores.rounds[roundId] = { score: existing + (points ?? 0) };
      }

      // Determine the most recent challenge (by createdAt) for the team's lastScore
      if (teamChallenges.length > 0) {
        const mostRecent = teamChallenges.reduce((a, b) =>
          a.createdAt > b.createdAt ? a : b,
        );
        const roundId = Number(mostRecent.roundId);
        const isRoundC = (roundId as Round) === Round.C;
        // Calculate accumulated total as straight sum of all round scores
        scores.total = Object.values(scores.rounds).reduce(
          (sum, r) => sum + (r.score ?? 0),
          0,
        );
        // lastScore should reflect the most recent single submission (apply freeze rule)
        const last = isRoundC && isFrozen ? 0 : mostRecent.points;
        // Attach lastScore so the client can read it directly
        (scores as unknown as Record<string, unknown>)["lastScore"] = last;
      } else {
        (scores as unknown as Record<string, unknown>)["lastScore"] = 0;
        scores.total = 0;
      }

      return scores;
    });

    // Sort by accumulated total descending
    return teamScores.sort((a, b) => b.total - a.total);
  }),
});
