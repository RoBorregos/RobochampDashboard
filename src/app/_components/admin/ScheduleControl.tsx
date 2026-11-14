"use client";

import { api } from "~/trpc/react";
import { toast } from "sonner";
import { useState } from "react";
import { WINDOWS, windowStart } from "~/lib/bracketSchedule";

interface Team {
  id: string;
  name: string;
  isActive: boolean;
  members?: Array<{ id: string; name: string | null; email: string | null }>;
}

interface Config {
  roundsRevealed?: number;
  competitionStarted?: boolean;
}

interface ScheduleControlProps {
  activeTeams: Team[];
  config?: Config;
  refetchScheduleTeams: () => void;
  refetchConfig: () => void;
}

type CellData = {
  id: string;
  team: string;
  time: string;
  initialTime: string;
  status: string;
} | null;

// Team, editable current time, and the original time when it was modified.
function PistaCell({
  cell,
  onSave,
}: {
  cell: CellData;
  onSave: (id: string, time: string) => void;
}) {
  if (!cell) return <>-</>;
  const changed = cell.time !== cell.initialTime;
  return (
    <div className="space-y-1">
      <div>{cell.team}</div>
      <input
        type="time"
        key={cell.time}
        defaultValue={cell.time}
        onBlur={(e) => {
          if (e.target.value && e.target.value !== cell.time) onSave(cell.id, e.target.value);
        }}
        className={`w-28 rounded bg-gray-600 p-1 text-sm ${changed ? "text-amber-300" : ""}`}
      />
      {changed && (
        <div className="text-xs text-gray-400">was {cell.initialTime}</div>
      )}
      {cell.status !== "ON_TIME" && (
        <div className="text-xs text-gray-400">{cell.status.replace("_", " ")}</div>
      )}
    </div>
  );
}

export default function ScheduleControl({
  refetchScheduleTeams,
}: ScheduleControlProps) {
  const { data: tables, refetch } = api.admin.getScheduleTables.useQuery();

  // Round start per category, prefilled from the itinerary (events.json).
  const [starts, setStarts] = useState(() =>
    Object.fromEntries(Object.entries(WINDOWS).map(([c, w]) => [c, w.map(([f]) => windowStart(f))])),
  );

  const generate = api.admin.generateFromBrackets.useMutation({
    onSuccess(data) {
      toast(`Generated ${data.runs} runs from the brackets`);
      data.warnings.forEach((w) => toast.warning(w));
      void refetchScheduleTeams();
      void refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateTime = api.admin.updateChallengeTime.useMutation({
    onSuccess: () => void refetch(),
    onError: () => toast("Error updating time"),
  });
  const saveTime = (id: string, time: string) => updateTime.mutate({ id, time });

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-gray-800 p-6">
        <h3 className="mb-4 text-xl font-semibold">Schedule</h3>
        <button
          onClick={() => generate.mutate({ starts })}
          disabled={generate.isPending}
          className="rounded bg-green-600 px-6 py-2 hover:bg-green-700 disabled:opacity-50"
        >
          {generate.isPending ? "Generating..." : "Regenerate from brackets"}
        </button>
        <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
          {Object.entries(starts).map(([cat, times]) =>
            times.map((v, r) => (
              <label key={`${cat}${r}`} className="flex items-center justify-between gap-2">
                {cat} - Round {r + 1} start (GMT-6, 14 Nov 2026)
                <input
                  type="time"
                  value={v}
                  onChange={(e) =>
                    setStarts({ ...starts, [cat]: times.map((x, i) => (i === r ? e.target.value : x)) })
                  }
                  className="rounded bg-gray-600 p-1"
                />
              </label>
            )),
          )}
        </div>
        <ul className="mt-4 space-y-1 text-sm text-gray-300">
          <li>• Beginners and Advanced: 2 rounds, 10 min per run (2 min calibration + 8 min execution).</li>
          <li>• Round windows come from the event agenda (events.json).</li>
          <li>• Odd bracket groups run track A, even groups track B; groups 1+2 start first, then 3+4, each group&apos;s first team before its second.</li>
          <li>• Saving a bracket regenerates its schedule automatically; manual time edits below are lost then.</li>
        </ul>
      </div>

      {tables?.map((t) => (
        <div key={`${t.category}${t.round}`} className="rounded-lg bg-gray-800 p-6">
          <h4 className="mb-4 text-lg font-semibold">
            {t.category} - Round {t.round}
          </h4>
          <table className="w-full border-collapse border border-gray-600">
            <thead>
              <tr className="bg-gray-700">
                <th className="border border-gray-600 p-3 text-left">Time</th>
                <th className="border border-gray-600 p-3 text-center">Pista A</th>
                <th className="border border-gray-600 p-3 text-center">Pista B</th>
              </tr>
            </thead>
            <tbody>
              {t.slots.map((slot) => (
                <tr key={slot.time} className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 font-mono">{slot.time}</td>
                  <td className="border border-gray-600 p-3 text-center">
                    <PistaCell cell={slot.pistaA} onSave={saveTime} />
                  </td>
                  <td className="border border-gray-600 p-3 text-center">
                    <PistaCell cell={slot.pistaB} onSave={saveTime} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
