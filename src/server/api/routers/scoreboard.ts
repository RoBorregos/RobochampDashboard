type TeamScores = {
  teamId: string;
  teamName: string;
  rounds: Record<number, { score: number }>;
  total: number;
  lastScore?: number;
  semi?: number;
  final?: number;
  category: string | null;
  /** "Group 1".. from the saved bracket, so it follows bracket edits. */
  group: string | null;
};

import { BracketCategory, Role } from "@prisma/client";
import { makeGroups } from "rbrgs/lib/makeGroups";
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
        category: true,
      },
    });
    const brackets = await ctx.db.bracket.findMany();
    const groupOf = new Map<string, string>();
    // Same rule as the brackets page: a category without a saved bracket gets the default groups.
    for (const cat of [BracketCategory.BEGINNERS, BracketCategory.ADVANCED]) {
      const saved = (brackets.find((b) => b.category === cat)?.data as { groups?: unknown } | undefined)?.groups;
      const groups =
        Array.isArray(saved) && saved.every(Array.isArray)
          ? (saved as string[][])
          : makeGroups(teams.filter((t) => t.category === cat).map((t) => t.name));
      groups.forEach((g, i) => g.forEach((name) => groupOf.set(name, `Group ${i + 1}`)));
    }
    const [challengesA, challengesB, challengesC, marsRuns] = await Promise.all([
      ctx.db.challengeA.findMany(),
      ctx.db.challengeB.findMany(),
      ctx.db.challengeC.findMany(),
      ctx.db.marsRun.findMany(),
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
    for (const ch of [...challengesC, ...marsRuns]) {
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
        category: team.category,
        group: groupOf.get(team.name) ?? null,
      };

      // One result per scheduled round (as roundMars enforces): duplicate rows from
      // several judges would otherwise be summed. Unscheduled runs (roundId "") all count.
      const latestPerRound = new Map<string, AnyChallenge>();
      const teamChallenges: AnyChallenge[] = [];
      for (const ch of challengesByTeam[team.id] ?? []) {
        if (ch.roundId === "") {
          teamChallenges.push(ch);
          continue;
        }
        const prev = latestPerRound.get(ch.roundId);
        if (!prev || ch.createdAt > prev.createdAt)
          latestPerRound.set(ch.roundId, ch);
      }
      teamChallenges.push(...latestPerRound.values());

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
        // Semi (round 4) and final (round 5) are independent scores, never added to the total.
        scores.total = Object.entries(scores.rounds).reduce(
          (sum, [r, v]) => ((Number(r) as Round) <= Round.C ? sum + (v.score ?? 0) : sum),
          0,
        );
        scores.semi = scores.rounds[4]?.score;
        scores.final = scores.rounds[5]?.score;
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
