"use client";

import React from "react";
import Footer from "../../_components/footer";
import Header from "../../_components/header";
import { api } from "~/trpc/react";
import LogoLoader from "~/app/_components/logo-loader";
import Title from "../../_components/title";
import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";
import { toast } from "sonner";

type ProcessedTeam = {
  teamId: string;
  teamName: string;
  rounds: Record<string, unknown> | Record<number, unknown>;
  total?: number;
  lastScore: number;
  accumulated: number;
  category?: string | null;
  group?: string | null;
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

  const role = useSession().data?.user?.role;
  const staff = role === Role.ADMIN || role === Role.JUDGE;
  const cancelRun = api.judge.cancelRun.useMutation({
    onSuccess() {
      toast("Run cancelled: the round now scores 0.");
      refetch().catch(console.error);
    },
    onError(error) {
      toast.error("Could not cancel the run.");
      console.error(error);
    },
  });
  const askCancel = (team: ProcessedTeam, round: number) => {
    if (
      window.prompt(
        `Cancel ${team.teamName}'s round ${round}? It will score 0 points. Type "CANCEL" to confirm.`,
      ) === "CANCEL"
    )
      cancelRun.mutate({ teamId: team.teamId, round });
  };

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

    const isRecord = (v: unknown): v is Record<string, unknown> =>
      v !== null && typeof v === "object" && !Array.isArray(v);

    const extractScore = (v: unknown): number => {
      if (!isRecord(v)) return 0;
      const maybeScore = v.score;
      if (typeof maybeScore === "number") return maybeScore;

      const a = typeof v.challengeA === "number" ? v.challengeA : 0;
      const b = typeof v.challengeB === "number" ? v.challengeB : 0;
      const c = typeof v.challengeC === "number" ? v.challengeC : 0;
      return a + b + c;
    };

    const raw = scores as unknown[];
    const teams: ProcessedTeam[] = raw.map((t): ProcessedTeam => {
      const teamObj = t as Record<string, unknown>;
      const teamId = typeof teamObj.teamId === "string" ? teamObj.teamId : "";
      const teamName =
        typeof teamObj.teamName === "string" ? teamObj.teamName : "";
      const roundsRaw = isRecord(teamObj.rounds) ? teamObj.rounds : {};

      const roundKeys = Object.keys(roundsRaw)
        .map((k) => Number(k))
        .filter((n) => !Number.isNaN(n));
      const lastRound = roundKeys.length ? Math.max(...roundKeys) : null;
      const lastScoreFromRounds =
        lastRound !== null ? extractScore(roundsRaw[String(lastRound)]) : 0;
      const lastScoreFromServer =
        typeof teamObj.lastScore === "number" ? teamObj.lastScore : undefined;
      const lastScore =
        typeof lastScoreFromServer === "number"
          ? lastScoreFromServer
          : lastScoreFromRounds;
      const accumulatedFromServer =
        typeof teamObj.total === "number" ? teamObj.total : undefined;
      const accumulated =
        typeof accumulatedFromServer === "number"
          ? accumulatedFromServer
          : roundKeys.reduce(
              (sum: number, r: number) =>
                sum + extractScore(roundsRaw[String(r)]),
              0,
            );

      return {
        teamId,
        teamName,
        rounds: roundsRaw,
        total: typeof teamObj.total === "number" ? teamObj.total : undefined,
        lastScore,
        accumulated,
        category: typeof teamObj.category === "string" ? teamObj.category : null,
        group: typeof teamObj.group === "string" ? teamObj.group : null,
      };
    });

    return teams.sort((a, b) => b.accumulated - a.accumulated);
  }, [scores]);

  if (isLoading || competitionStarted === undefined) return <LogoLoader />;

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
                      processed.slice(0, 5).map((team) => (
                        <tr
                          key={team.teamId}
                          className="border-b border-gray-700"
                        >
                          <td className="p-4 font-medium">
                            {team.teamName}
                            {team.group && (
                              <span className="ml-2 text-xs text-slate-500">
                                {team.category?.toLowerCase()} · {team.group}
                              </span>
                            )}
                          </td>
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
                  <td className="p-4 font-medium">
                            {team.teamName}
                            {team.group && (
                              <span className="ml-2 text-xs text-slate-500">
                                {team.category?.toLowerCase()} · {team.group}
                              </span>
                            )}
                            {staff && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {Object.entries(team.rounds).map(([round, r]) => (
                                  <button
                                    key={round}
                                    type="button"
                                    disabled={cancelRun.isPending}
                                    onClick={() => askCancel(team, Number(round))}
                                    className="rounded border border-red-700 px-2 py-0.5 text-xs text-red-400 hover:bg-red-950 disabled:opacity-40"
                                  >
                                    R{round}: {(r as { score?: number }).score ?? 0} · Cancel run
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
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
