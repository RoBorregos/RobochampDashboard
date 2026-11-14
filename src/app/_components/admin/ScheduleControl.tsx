"use client";

import { api } from "~/trpc/react";
import { toast } from "sonner";
import { useState } from "react";

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
  activeTeams,
  config,
  refetchScheduleTeams,
}: ScheduleControlProps) {
  const [round1StartTime, setRound1StartTime] = useState("08:30");
  const [round2StartTime, setRound2StartTime] = useState("12:30");
  const [round3StartTime, setRound3StartTime] = useState("16:30");
  const [selectedRound, setSelectedRound] = useState(1);
  const [showTables, setShowTables] = useState(false);

  const regenerateSchedules = api.admin.regenerateSchedules.useMutation({
    onSuccess(data) {
      toast(
        `Generated ${data.tablesGenerated} schedule tables for ${data.teamsScheduled} teams!`,
      );
      void refetchScheduleTeams();
      setShowTables(true);
    },
    onError(error) {
      toast("Error regenerating schedules");
      console.error(error);
    },
  });

  const { data: scheduleTables, refetch: refetchTables } =
    api.admin.getScheduleTables.useQuery(undefined, { enabled: showTables });

  const runTestCase = api.admin.runTestCase.useMutation({
    onSuccess(data) {
      toast(
        `${data.message} - ${data.teamsCreated} teams, ${data.tablesGenerated} tables generated`,
      );
      void refetchScheduleTeams();
      setShowTables(true);
      void refetchTables();
    },
    onError(error) {
      toast("Error running test case");
      console.error(error);
    },
  });

  const generateSingleRound = api.admin.generateSingleRound.useMutation({
    onSuccess(data) {
      toast(
        `Round ${data.roundNumber} generated! ${data.teamsScheduled} teams scheduled, ${data.tablesGenerated} tables created`,
      );
      void refetchScheduleTeams();
      setShowTables(true);
      void refetchTables();
    },
    onError(error) {
      toast("Error generating single round");
      console.error(error);
    },
  });

  const updateTime = api.admin.updateChallengeTime.useMutation({
    onSuccess() {
      void refetchTables();
    },
    onError() {
      toast("Error updating time");
    },
  });
  const saveTime = (id: string, time: string) => updateTime.mutate({ id, time });

  const handleRegenerateSchedules = () => {
    regenerateSchedules.mutate({
      round1StartTime,
      round2StartTime,
      round3StartTime,
    });
  };

  const handleGenerateForRound = (round: number) => {
    const startTime =
      round === 1
        ? round1StartTime
        : round === 2
          ? round2StartTime
          : round3StartTime;

    generateSingleRound.mutate({
      roundNumber: round,
      startTime: startTime,
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-gray-800 p-6">
        <h3 className="mb-4 text-xl font-semibold">Schedule Generation</h3>

        <div className="mb-6">
          <h4 className="mb-3 text-lg font-medium">Quick Generate by Round</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((round) => {
              const time =
                round === 1
                  ? round1StartTime
                  : round === 2
                    ? round2StartTime
                    : round3StartTime;

              return (
                <div key={round} className="rounded-lg bg-gray-700 p-4">
                  <h5 className="mb-2 font-medium">Round {round}</h5>
                  <div className="mb-2">
                    <label className="text-xs text-gray-400">
                      Start Time (24h format)
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => {
                        if (round === 1) setRound1StartTime(e.target.value);
                        else if (round === 2)
                          setRound2StartTime(e.target.value);
                        else setRound3StartTime(e.target.value);
                      }}
                      className="mb-1 w-full rounded border border-gray-600 bg-gray-600 p-2"
                    />
                  </div>
                  <button
                    onClick={() => handleGenerateForRound(round)}
                    disabled={
                      generateSingleRound.isPending || activeTeams.length === 0
                    }
                    className="w-full rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {generateSingleRound.isPending &&
                    generateSingleRound.variables?.roundNumber === round
                      ? "Generating..."
                      : `Generate Round ${round}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleRegenerateSchedules}
            disabled={regenerateSchedules.isPending || activeTeams.length === 0}
            className="rounded bg-green-600 px-6 py-2 hover:bg-green-700 disabled:opacity-50"
          >
            {regenerateSchedules.isPending
              ? "Generating..."
              : "Generate All 9 Schedule Tables"}
          </button>

          <button
            onClick={() => runTestCase.mutate()}
            disabled={runTestCase.isPending}
            className="rounded bg-purple-600 px-6 py-2 hover:bg-purple-700 disabled:opacity-50"
          >
            {runTestCase.isPending ? "Running..." : "Run Test Case (6 Teams)"}
          </button>

          {scheduleTables && scheduleTables.length > 0 && (
            <button
              onClick={() => {
                setShowTables(!showTables);
                if (!showTables) void refetchTables();
              }}
              className="rounded bg-blue-600 px-6 py-2 hover:bg-blue-700"
            >
              {showTables ? "Hide" : "Show"} Schedule Tables
            </button>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-gray-700 p-4">
          <h4 className="mb-2 font-semibold">
            Systematic Pista Rotation Algorithm:
          </h4>
          <ul className="space-y-1 text-sm text-gray-300">
            <li>
              • <strong>9 Tables Total:</strong> 3 challenges per round x 3
              rounds = 9 schedule tables
            </li>
            <li>
              • <strong>Simultaneous Competition:</strong> 3 teams compete at
              the same time
            </li>
            <li>
              • <strong>Systematic Rotation:</strong> Each team follows a
              predictable pista sequence across rounds
            </li>
            <li>
              • <strong>Example Pattern:</strong> Team A: Round 1 (A→B→C), Round
              2 (B→C→A), Round 3 (C→A→B)
            </li>
            <li>
              • <strong>6 minutes per slot:</strong> 5 minutes competition + 1
              minute transition
            </li>
            <li>
              • <strong>Fair Distribution:</strong> All teams experience each
              pista equally across all rounds
            </li>
          </ul>
        </div>

        <div className="mt-4 rounded-lg bg-blue-900 p-4">
          <h4 className="mb-2 font-semibold">Test Case Instructions:</h4>
          <ol className="space-y-1 text-sm text-blue-200">
            <li>1. Click &quot;Run Test Case (6 Teams)&quot; to create 6 sample teams</li>
            <li>
              2. The system will automatically generate all 9 tables with
              systematic rotation
            </li>
            <li>
              3. Click &quot;Show Schedule Tables&quot; to view the generated schedules
            </li>
            <li>
              4. Verify that teams follow the rotation pattern across rounds
            </li>
            <li>5. Each table should show 3 teams competing simultaneously</li>
          </ol>
        </div>

        <div className="mt-4 rounded-lg bg-gray-700 p-4">
          <h4 className="mb-2 font-semibold">Current Status:</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <p>Active teams: {activeTeams.length}</p>
            <p>
              Time slots needed: {Math.ceil(activeTeams.length / 3)} per
              challenge
            </p>
            <p>
              Duration per challenge: ~{Math.ceil(activeTeams.length / 3) * 6}{" "}
              minutes
            </p>
            <p>Rounds revealed: {config?.roundsRevealed ?? 0}/3</p>
            <p>Tables generated: {scheduleTables?.length ?? 0}/9</p>
            <p>
              Competition started: {config?.competitionStarted ? "Yes" : "No"}
            </p>
          </div>
        </div>
      </div>

      {showTables && scheduleTables && scheduleTables.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-semibold">Generated Schedule Tables</h3>
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(Number(e.target.value))}
              className="rounded bg-gray-700 p-2"
            >
              <option value={1}>Round 1</option>
              <option value={2}>Round 2</option>
              <option value={3}>Round 3</option>
            </select>
          </div>

          {scheduleTables
            .filter((table) => table.round === selectedRound)
            .map((table, index) => (
              <div key={index} className="rounded-lg bg-gray-800 p-6">
                <h4 className="mb-4 text-lg font-semibold">
                  Round {table.round} - {table.challengeName}
                </h4>

                {table.timeSlots.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-600">
                      <thead>
                        <tr className="bg-gray-700">
                          <th className="border border-gray-600 p-3 text-left">
                            Time
                          </th>
                          <th className="border border-gray-600 p-3 text-center">
                            Pista A
                          </th>
                          <th className="border border-gray-600 p-3 text-center">
                            Pista B
                          </th>
                          <th className="border border-gray-600 p-3 text-center">
                            Pista C
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.timeSlots.map((slot, slotIndex) => (
                          <tr key={slotIndex} className="hover:bg-gray-700">
                            <td className="border border-gray-600 p-3 font-mono">
                              {slot.time}
                            </td>
                            <td className="border border-gray-600 p-3 text-center">
                              <PistaCell cell={slot.pistaA} onSave={saveTime} />
                            </td>
                            <td className="border border-gray-600 p-3 text-center">
                              <PistaCell cell={slot.pistaB} onSave={saveTime} />
                            </td>
                            <td className="border border-gray-600 p-3 text-center">
                              <PistaCell cell={slot.pistaC} onSave={saveTime} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-400">
                    No schedule data available for this table.
                  </p>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
