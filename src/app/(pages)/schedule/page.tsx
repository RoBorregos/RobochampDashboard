"use client";

import Header from "~/app/_components/header";
import { api } from "~/trpc/react";

type ScheduleChallenge = {
  name: string;
  time: string | Date;
};

type ScheduleRound = {
  number: number;
  challenges: ScheduleChallenge[];
};

type ScheduleTeam = {
  id?: string;
  name: string;
  rounds: ScheduleRound[];
};

type Cell = { A?: string; B?: string };
type RoundBucket = { times: Set<string>; rows: Record<string, Cell> };

export default function SchedulePage() {
  const query = api.team.getVisibleSchedules.useQuery();
  const isArray = Array.isArray(query.data);
  const teams: ScheduleTeam[] = isArray ? (query.data as ScheduleTeam[]) : [];
  const { isLoading } = query;

  /** Rondas reveladas = cantidad de números de ronda únicos presentes */
  const roundsRevealed =
    teams.length > 0
      ? new Set(teams.flatMap((t) => (t.rounds ?? []).map((r) => r.number)))
          .size
      : 0;

  if (isLoading) {
    return (
      <main className="mt-[4rem] min-h-screen bg-black text-white">
        <div className="md:pb-10">
          <Header title="Schedules" subtitle="Loading schedules..." />
        </div>
        <div className="flex h-64 items-center justify-center">
          <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-roboblue" />
        </div>
      </main>
    );
  }

  if (teams.length === 0) {
    return (
      <main className="mt-[4rem] min-h-screen bg-black text-white">
        <div className="md:pb-10">
          <Header title="Schedules" subtitle="No schedules available yet" />
        </div>
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <p className="text-xl text-gray-400">
              Schedules will be revealed soon
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Rounds revealed: {roundsRevealed}/3
            </p>
          </div>
        </div>
      </main>
    );
  }

  const toDate = (d: Date | string): Date =>
    d instanceof Date ? d : new Date(d);
  const toTimeKey = (d: Date): string => {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };
  const getTrackFromName = (name: string): "A" | "B" | null => {
    const n = name.toLowerCase();
    if (n.includes("pista a") || n.includes("track a")) return "A";
    if (n.includes("pista b") || n.includes("track b")) return "B";
    return null;
  };

  const roundBuckets: Record<number, RoundBucket> = {};

  for (const team of teams) {
    for (const round of team.rounds ?? []) {
      if (round.number > roundsRevealed) continue;

      const rn = Number(round.number);
      const bucket = (roundBuckets[rn] ??= {
        times: new Set<string>(),
        rows: {},
      });

      for (const ch of round.challenges ?? []) {
        const track = getTrackFromName(ch.name);
        if (!track) continue;

        const tKey = toTimeKey(toDate(ch.time));
        bucket.times.add(tKey);

        const row = (bucket.rows[tKey] ??= {});
        if (track === "A") row.A = team.name ?? "";
        else if (track === "B") row.B = team.name ?? "";
      }
    }
  }

  const rounds = Object.keys(roundBuckets)
    .map((k) => Number(k))
    .sort((a, b) => a - b);

  return (
    <main className="mt-[4rem] min-h-screen bg-black text-white">
      <div className="md:pb-10">
        <Header
          title="Competition Schedules"
          subtitle={`Rounds revealed: ${roundsRevealed}/3`}
        />
      </div>

      <div className="container mx-auto px-4 py-8">
        {rounds.length > 0 ? (
          rounds.map((round) => {
            const bucket = roundBuckets[round];
            if (!bucket) return null;

            const times = Array.from(bucket.times).sort((a, b) =>
              a.localeCompare(b),
            );

            return (
              <div key={round} className="mb-12">
                <div className="mb-3 rounded-lg bg-gradient-to-r from-roboblue to-blue-600 p-4">
                  <h2 className="text-center text-2xl font-bold">
                    Round {round}
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full overflow-hidden rounded-lg bg-gray-900">
                    <thead>
                      <tr className="bg-gray-800">
                        <th className="p-4 text-left font-semibold">Time</th>
                        <th className="p-4 text-left font-semibold">Track A</th>
                        <th className="p-4 text-left font-semibold">Track B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {times.map((t, idx) => {
                        const cell = bucket.rows[t] ?? {};
                        return (
                          <tr
                            key={`${round}-${t}`}
                            className={`border-b border-gray-700 ${
                              idx % 2 === 0 ? "bg-gray-800" : "bg-gray-900"
                            } transition-colors hover:bg-gray-700`}
                          >
                            <td className="p-4 font-mono font-medium">{t}</td>
                            <td className="p-4">
                              {cell.A ?? (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              {cell.B ?? (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center">
            <h3 className="mb-2 text-xl font-semibold">No rounds available</h3>
            <p className="text-gray-400">
              Schedules will be published as the competition progresses
            </p>
          </div>
        )}

        <div className="mt-8 rounded-lg bg-gray-900 p-6">
          <h3 className="mb-4 text-lg font-semibold text-roboblue">
            Important Information
          </h3>
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-semibold text-white">Event Format:</h4>
              <ul className="space-y-1 text-gray-300">
                <li>3 competition rounds</li>
                <li>2 tracks per round (A, B)</li>
                <li>Each team goes through both tracks each round</li>
                <li>
                  7 minutes per slot: 1 minute calibration + 6 minutes run
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold text-white">Instructions:</h4>
              <ul className="space-y-1 text-gray-300">
                <li>Arrive 5 minutes before your scheduled time</li>
                <li>Schedules may be adjusted based on availability</li>
                <li>Only currently available rounds are shown</li>
                <li>Check regularly for updates</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
