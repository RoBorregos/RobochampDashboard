"use client";

import { api } from "~/trpc/react";
import { toast } from "sonner";

interface Config {
  roundsRevealed?: number;
  competitionStarted?: boolean;
}

interface Team {
  id: string;
  name: string;
  isActive?: boolean;
}

interface RoundControlProps {
  config?: Config;
  teams?: Team[];
  refetchConfig: () => void;
}

export default function RoundControl({
  config,
  teams,
  refetchConfig,
}: RoundControlProps) {
  const { data: roundVisibility, refetch: refetchRoundVisibility } =
    api.admin.getRoundVisibilityStatus.useQuery(undefined, {
      refetchOnWindowFocus: true,
      refetchInterval: 2000,
      staleTime: 1000,
    });

  const toggleRoundVisibility = api.admin.toggleRoundVisibility.useMutation({
    onSuccess(data) {
      const action = data.isVisible ? "revealed" : "hidden";
      toast.success(
        `Round ${data.roundNumber} ${action}! (${data.totalRevealed} rounds visible)`,
      );

      setTimeout(() => {
        void refetchConfig();
        void refetchRoundVisibility();
      }, 100);
    },
    onError(error) {
      const errorMessage = error.message || "Unknown error occurred";
      toast.error(`Error toggling round visibility: ${errorMessage}`);
      console.error("Toggle error:", error);

      setTimeout(() => {
        void refetchRoundVisibility();
      }, 500);
    },
  });

  const revealNextRound = api.admin.revealNextRound.useMutation({
    onSuccess(data) {
      toast.success(`Round ${data.roundNumber} revealed!`);

      setTimeout(() => {
        void refetchConfig();
        void refetchRoundVisibility();
      }, 100);
    },
    onError(error) {
      const errorMessage = error.message || "Unknown error occurred";
      toast.error(`Error revealing round: ${errorMessage}`);
      console.error("Reveal error:", error);

      setTimeout(() => {
        void refetchRoundVisibility();
      }, 500);
    },
  });

  const setScoreboard = api.admin.setScoreboardVisible.useMutation({
    onSuccess(data) {
      toast.success(`Scoreboard ${data.visible ? "shown" : "hidden"}`);
      void refetchConfig();
    },
    onError(error) {
      toast.error(`Error updating scoreboard: ${error.message}`);
    },
  });

  const handleToggleRound = (
    roundNumber: number,
    currentlyVisible: boolean,
  ) => {
    const newVisibility = !currentlyVisible;
    console.log(
      `Toggling round ${roundNumber} from ${currentlyVisible} to ${newVisibility}`,
    );

    toggleRoundVisibility.mutate({
      roundNumber,
      isVisible: newVisibility,
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-gray-800 p-6">
        <h3 className="mb-4 text-xl font-semibold">Round Visibility Control</h3>
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((roundNum) => {
            const isVisible = roundVisibility?.[roundNum] ?? false;
            return (
              <div
                key={roundNum}
                className={`rounded-lg border p-4 ${
                  isVisible
                    ? "border-green-500 bg-green-900"
                    : "border-gray-600 bg-gray-700"
                }`}
              >
                <h4 className="mb-2 font-semibold">Round {roundNum}</h4>
                <p className="mb-3 text-sm">
                  Status: {isVisible ? "Visible" : "Hidden"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleRound(roundNum, isVisible)}
                    disabled={toggleRoundVisibility.isPending}
                    className={`rounded px-3 py-1 text-sm transition-colors disabled:opacity-50 ${
                      isVisible
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {toggleRoundVisibility.isPending
                      ? "Working..."
                      : isVisible
                        ? "Hide"
                        : "Show"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => revealNextRound.mutate()}
            disabled={
              revealNextRound.isPending ||
              Object.values(roundVisibility ?? {}).filter(Boolean).length >= 3
            }
            className="rounded-lg bg-blue-600 px-6 py-2 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
          >
            {revealNextRound.isPending ? "Revealing..." : "Reveal Next Round"}
          </button>

          <button
            onClick={() => {
              [1, 2, 3].forEach((round) => {
                if (roundVisibility?.[round]) {
                  handleToggleRound(round, true);
                }
              });
            }}
            disabled={toggleRoundVisibility.isPending}
            className="rounded-lg bg-red-600 px-6 py-2 hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-600"
          >
            Hide All Rounds
          </button>

          <button
            onClick={() =>
              setScoreboard.mutate({ visible: !config?.competitionStarted })
            }
            disabled={setScoreboard.isPending}
            className="rounded-lg bg-purple-600 px-6 py-2 hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-600"
          >
            {config?.competitionStarted ? "Hide Scoreboard" : "Show Scoreboard"}
          </button>
        </div>

        <div className="mt-4 rounded-lg bg-gray-700 p-4">
          <h4 className="mb-2 font-semibold">Current Competition Status:</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <p>
              Visible rounds:{" "}
              {Object.values(roundVisibility ?? {}).filter(Boolean).length}/3
            </p>
            <p>Round 1: {roundVisibility?.[1] ? "Visible" : "Hidden"}</p>
            <p>Round 2: {roundVisibility?.[2] ? "Visible" : "Hidden"}</p>
            <p>Round 3: {roundVisibility?.[3] ? "Visible" : "Hidden"}</p>
            <p>Total teams: {teams?.length ?? 0}</p>
            <p>
              Competition started: {config?.competitionStarted ? "Yes" : "No"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-blue-900 p-4">
          <h4 className="mb-2 font-semibold">Independent Round Control:</h4>
          <ul className="space-y-1 text-sm text-blue-200">
            <li>
              • <strong>Individual Control:</strong> Each round can be
              shown/hidden independently
            </li>
            <li>
              • <strong>Show Button:</strong> Makes a round visible so teams can
              see their schedules
            </li>
            <li>
              • <strong>Hide Button:</strong> Hides a specific round
            </li>
            <li>
              • <strong>Reveal Next:</strong> Automatically reveals the next
              hidden round in sequence
            </li>
            <li>
              • <strong>Hide All:</strong> Quickly hides all visible rounds
            </li>
            <li>
              • <strong>Real-time Status:</strong> See exactly which rounds are
              visible or hidden
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
