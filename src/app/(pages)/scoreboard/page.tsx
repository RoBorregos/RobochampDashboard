"use client";

import React from "react";
import Footer from "../../_components/footer";
import Header from "../../_components/header";
import { api } from "~/trpc/react";
import Title from "../../_components/title";

type RoundScores = { score: number };
type TeamScore = {
  teamId: string;
  teamName: string;
  // rounds keys can come as strings (from JSON) or numbers; the shape is unknown from the API
  rounds: Record<string, unknown> | Record<number, unknown>;
  total?: number;
};
type ProcessedTeam = {
  teamId: string;
  teamName: string;
  rounds: Record<string, unknown> | Record<number, unknown>;
  total?: number;
  lastScore: number;
  accumulated: number;
};

const TwitchEmbed = ({ channel }: { channel: string }) => (
  <div className="aspect-video w-full">
    <iframe
      src={`https://player.twitch.tv/?channel=${channel}&parent=candidates.roborregos.com`}
      className="h-full w-full"
      height={"100%"}
      width={"100%"}
      allowFullScreen
    />
  </div>
);

export default function ScoreboardPage() {
  const {
    data: scores,
    isLoading,
    refetch,
  } = api.scoreboard.getScoreboard.useQuery();

  const { data: competitionStarted } =
    api.config.isCompetitionStarted.useQuery();

  React.useEffect(() => {
    const interval = setInterval(() => {
      refetch().catch(console.error);
    }, 20000);
    return () => clearInterval(interval);
  }, [refetch]);

  const processed = React.useMemo<ProcessedTeam[]>(() => {
    if (!scores) return [];

    // helper type guards
    const isRecord = (v: unknown): v is Record<string, unknown> =>
      v !== null && typeof v === "object" && !Array.isArray(v);

    const extractScore = (v: unknown): number => {
      if (!isRecord(v)) return 0;
      const maybeScore = v["score"];
      if (typeof maybeScore === "number") return maybeScore;

      // backward-compat: if API still returns per-challenge fields, sum them
      const a =
        typeof v["challengeA"] === "number" ? (v["challengeA"] as number) : 0;
      const b =
        typeof v["challengeB"] === "number" ? (v["challengeB"] as number) : 0;
      const c =
        typeof v["challengeC"] === "number" ? (v["challengeC"] as number) : 0;
      return a + b + c;
    };

    const raw = scores as unknown[] as unknown[];
    const teams: ProcessedTeam[] = raw.map((t) => {
      // try to safely read expected fields
      const teamObj = t as unknown as Record<string, unknown>;
      const teamId =
        typeof teamObj["teamId"] === "string"
          ? (teamObj["teamId"] as string)
          : "";
      const teamName =
        typeof teamObj["teamName"] === "string"
          ? (teamObj["teamName"] as string)
          : "";
      const roundsRaw = isRecord(teamObj["rounds"])
        ? (teamObj["rounds"] as Record<string, unknown>)
        : {};

      const roundKeys = Object.keys(roundsRaw)
        .map((k) => Number(k))
        .filter((n) => !Number.isNaN(n));
      const lastRound = roundKeys.length ? Math.max(...roundKeys) : null;
      const lastScoreFromRounds =
        lastRound !== null ? extractScore(roundsRaw[String(lastRound)]) : 0;
      const lastScoreFromServer =
        typeof teamObj["lastScore"] === "number"
          ? (teamObj["lastScore"] as number)
          : undefined;
      const lastScore = typeof lastScoreFromServer === "number" ? lastScoreFromServer : lastScoreFromRounds;
      // Prefer the server-provided `total` when available — server already
      // computes accumulated sums. Fall back to summing rounds client-side.
      const accumulatedFromServer =
        typeof teamObj["total"] === "number"
          ? (teamObj["total"] as number)
          : undefined;
      const accumulated =
        typeof accumulatedFromServer === "number"
          ? accumulatedFromServer
          : roundKeys.reduce(
              (sum: number, r: number) => sum + extractScore(roundsRaw[String(r)]),
              0,
            );

      return {
        teamId,
        teamName,
        rounds: roundsRaw,
        total:
          typeof teamObj["total"] === "number"
            ? (teamObj["total"] as number)
            : undefined,
        lastScore,
        accumulated,
      } as ProcessedTeam;
    });

    return teams.sort((a, b) => b.accumulated - a.accumulated);
  }, [scores]);

  if (!competitionStarted) {
    return (
      <div className="mt-[4rem] h-96 bg-black text-white">
        <Header title="Scoreboard" />
        <p className="my-10 text-center text-lg">
          The competition will start soon!
        </p>
        <Footer />
      </div>
    );
  }

  return (
    <div className="mt-[4rem] min-h-[24rem] bg-black text-sm text-white md:text-base">
      <Header title="Scoreboard" />

      <div className="container mx-auto overflow-x-scroll p-4 scrollbar-thin scrollbar-track-gray-700 scrollbar-thumb-roboblue">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="w-full">
            <TwitchEmbed channel="RoBorregosTeam" />
          </div>

          <div className="my-auto w-full">
            <div className="space-y-4">
              <div className="w-full">
                <table className="w-full table-fixed border-collapse text-white">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="p-4 text-left">Team</th>
                      <th className="p-4 text-right">Last Round Score</th>
                      <th className="p-4 text-right">Accumulated Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processed.length > 0 ? (
                      processed.slice(0, 5).map((team, idx) => (
                        <tr
                          key={team.teamId}
                          className="border-b border-gray-700"
                        >
                          <td className="p-4 font-medium">{team.teamName}</td>
                          <td className="p-4 text-right">{team.lastScore}</td>
                          <td className="p-4 text-right font-semibold">
                            {team.total ?? team.accumulated}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center">
                          {isLoading ? "Loading..." : "No data available"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Title title="General" />

      <div className="mx-auto w-full max-w-7xl px-4">
        <table className="w-full table-fixed border-collapse text-white">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="p-4 text-left">Team</th>
              <th className="p-4 text-right">Last Round Score</th>
              <th className="p-4 text-right">Accumulated Score</th>
            </tr>
          </thead>
          <tbody>
            {processed.length > 0 ? (
              processed.map((team) => (
                <tr
                  key={team.teamId}
                  className="border-b border-gray-700 transition-colors hover:bg-gray-800/30"
                >
                  <td className="p-4 font-medium">{team.teamName}</td>
                  <td className="p-4 text-right">{team.lastScore}</td>
                  <td className="p-4 text-right font-semibold">
                    {team.total ?? team.accumulated}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="p-4 text-center">
                  {isLoading ? "Loading..." : "No data available"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Footer />
    </div>
  );
}
