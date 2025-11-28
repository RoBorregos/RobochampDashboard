type TeamScores = {
  teamId: string;
  teamName: string;
  rounds: Record<number, { score: number }>;
  total: number;
  lastScore?: number;
};

import { Role } from "@prisma/client";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { Round } from "rbrgs/lib/round";

export const scoreboardRouter = createTRPCRouter({
  getScoreboard: publicProcedure.query(async ({ ctx }) => {
    const config = await ctx.db.config.findFirst();
    const isAdmin = ctx.session?.user.role == Role.ADMIN;
    let isFrozen = config?.freeze ?? false;
    if (isAdmin) {
      isFrozen = false;
    }
    const teams = await ctx.db.team.findMany({
      select: {
        id: true,
        name: true,
      },
    });
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

    const challengesByTeam: Record<string, AnyChallenge[]> = {};
    for (const ch of allChallenges) {
      const list =
        challengesByTeam[ch.teamId] ?? (challengesByTeam[ch.teamId] = []);
      list.push(ch);
    }

    const teamScores: TeamScores[] = teams.map((team) => {
      const scores: TeamScores = {
        teamId: team.id,
        teamName: team.name,
        rounds: {},
        total: 0,
      };

      const teamChallenges = challengesByTeam[team.id] ?? [];

      for (const ch of teamChallenges) {
        const roundId = Number(ch.roundId);
        if (isNaN(roundId)) continue;
        const isRoundC = (roundId as Round) === Round.C;
        const points = isRoundC && isFrozen ? 0 : ch.points;
        const existing = scores.rounds[roundId]?.score ?? 0;
        scores.rounds[roundId] = { score: existing + (points ?? 0) };
      }

      if (teamChallenges.length > 0) {
        const mostRecent = teamChallenges.reduce((a, b) =>
          a.createdAt > b.createdAt ? a : b,
        );
        const roundId = Number(mostRecent.roundId);
        const isRoundC = (roundId as Round) === Round.C;
        scores.total = Object.values(scores.rounds).reduce(
          (sum, r) => sum + (r.score ?? 0),
          0,
        );
        const last = isRoundC && isFrozen ? 0 : mostRecent.points;
        scores.lastScore = last;
      } else {
        scores.lastScore = 0;
        scores.total = 0;
      }

      return scores;
    });

    return teamScores.sort((a, b) => b.total - a.total);
  }),
});
