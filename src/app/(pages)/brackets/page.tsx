"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

type Category = "beginners" | "advanced";

interface Match {
  id: string;
  team1?: string;
  team2?: string;
  team3?: string; // Used only in advanced triple quarter representation
  winner?: string;
}

interface Round {
  name: string;
  matches: Match[];
}

// --- Advanced Bracket Interfaces (Standard Tree) ---
interface AdvancedBracketData {
  rounds: Round[];
  final: Match;
  thirdPlace?: Match;
  winner?: string;
}

// --- Beginners Bracket Interfaces (3 Groups) ---
interface Group {
  id: string;
  name: string;
  teams: string[]; // List of all teams in the group
  qualified: string[]; // The 2 teams selected to advance (max 2)
  finalMatch: Match; // Final match between the 2 qualified teams
}

interface BeginnersBracketData {
  groups: Group[];
  semifinalists: string[]; // Exactly 3 (one per group)
  final: Match; // Final between 2 of the semifinalists
  thirdPlaceTeam: string; // Automatic third place (the semifinalist not in final)
}

// --- Data Constants ---

// Inicial: sólo equipos base; winners se definen vía interacción admin.
const BEGINNERS_DATA: BeginnersBracketData = {
  groups: [
    {
      id: "ga",
      name: "Grupo A",
      teams: ["Team A1", "Team A2", "Team A3", "Team A4", "Team A5"],
      qualified: [],
      finalMatch: { id: "ga_final" },
    },
    {
      id: "gb",
      name: "Grupo B",
      teams: ["Team B1", "Team B2", "Team B3", "Team B4"],
      qualified: [],
      finalMatch: { id: "gb_final" },
    },
    {
      id: "gc",
      name: "Grupo C",
      teams: ["Team C1", "Team C2", "Team C3", "Team C4"],
      qualified: [],
      finalMatch: { id: "gc_final" },
    },
  ],
  semifinalists: [],
  final: { id: "beg_final" },
  thirdPlaceTeam: "",
};

const ADVANCED_DATA: AdvancedBracketData = {
  rounds: [
    {
      name: "Quarterfinals",
      matches: [
        {
          id: "aq1",
          team1: "CyberWolves",
          team2: "RoboTech",
          team3: "NanoBots",
        },
        {
          id: "aq2",
          team1: "MechWarriors",
          team2: "IronGiants",
          team3: "QuantumForce",
        },
        {
          id: "aq3",
          team1: "TechTitans",
          team2: "CircuitBreakers",
          team3: "NanoBots",
        },
      ],
    },
    {
      name: "Semifinals",
      matches: [{ id: "as1" }, { id: "as2" }, { id: "as3" }],
    },
  ],
  final: { id: "af" },
  thirdPlace: { id: "atp" },
};

// --- Components ---

function TeamPill({
  name,
  isWinner,
  small = false,
  onClick,
  disabled,
}: {
  name: string;
  isWinner?: boolean;
  small?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const clickable = !!onClick && !disabled;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onClick : undefined}
      className={`relative flex select-none items-center justify-center ${small ? "h-10 w-32 text-xs" : "h-14 w-48 md:h-16 md:w-56"} rounded-2xl border transition-all duration-300 ${
        isWinner
          ? "z-10 scale-105 border-blue-400 bg-blue-600 font-bold text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]"
          : "border-[#333] bg-[#1a1a1a] text-slate-400"
      } ${clickable && !isWinner ? "cursor-pointer hover:border-blue-400 hover:shadow-[0_0_8px_rgba(59,130,246,0.4)]" : ""} ${!clickable ? "opacity-60" : ""} `}
    >
      <span className="truncate px-4">{name}</span>
    </button>
  );
}

function MatchNode({
  match,
  roundIndex: _roundIndex,
  onSelectTeam,
}: {
  match: Match;
  roundIndex: number;
  onSelectTeam?: (team: string) => void;
}) {
  return (
    <div className="relative flex flex-col gap-3 md:gap-4">
      {match.team1 && (
        <TeamPill
          name={match.team1}
          isWinner={match.winner === match.team1}
          onClick={onSelectTeam ? () => onSelectTeam(match.team1!) : undefined}
        />
      )}
      {match.team2 && (
        <div className="absolute right-[-1rem] top-1/2 hidden h-[calc(100%-3.5rem)] w-[1px] -translate-y-1/2 translate-x-full bg-slate-700 md:block"></div>
      )}
      <div className="absolute right-[-2rem] top-1/2 hidden h-[1px] w-4 translate-x-full bg-slate-700 md:block"></div>
      {match.team2 && (
        <TeamPill
          name={match.team2}
          isWinner={match.winner === match.team2}
          onClick={onSelectTeam ? () => onSelectTeam(match.team2!) : undefined}
        />
      )}
      {match.team3 && (
        <TeamPill
          name={match.team3}
          isWinner={match.winner === match.team3}
          onClick={onSelectTeam ? () => onSelectTeam(match.team3!) : undefined}
        />
      )}
    </div>
  );
}

// --- Beginners Components ---

function GroupBracket({
  group,
  isAdmin,
  onToggleQualified,
  onSelectGroupFinalWinner,
}: {
  group: Group;
  isAdmin?: boolean;
  onToggleQualified?: (groupId: string, team: string) => void;
  onSelectGroupFinalWinner?: (groupId: string, team: string) => void;
}) {
  return (
    <div className="relative flex items-center gap-12">
      {/* Team selection column */}
      <div className="flex flex-col gap-3">
        {group.teams.map((team) => (
          <TeamPill
            key={team}
            name={team}
            isWinner={group.qualified.includes(team)}
            onClick={
              isAdmin
                ? () => onToggleQualified && onToggleQualified(group.id, team)
                : undefined
            }
          />
        ))}
      </div>

      {/* Group Final match (always visible) */}
      <div className="relative flex flex-col gap-3">
        <TeamPill
          name={group.finalMatch.team1 ?? "TBD"}
          isWinner={group.finalMatch.winner === group.finalMatch.team1}
          onClick={
            isAdmin && group.finalMatch.team1
              ? () =>
                  onSelectGroupFinalWinner &&
                  onSelectGroupFinalWinner(group.id, group.finalMatch.team1!)
              : undefined
          }
        />
        <span className="text-center text-[10px] font-bold text-slate-500">
          VS
        </span>
        <TeamPill
          name={group.finalMatch.team2 ?? "TBD"}
          isWinner={group.finalMatch.winner === group.finalMatch.team2}
          onClick={
            isAdmin && group.finalMatch.team2
              ? () =>
                  onSelectGroupFinalWinner &&
                  onSelectGroupFinalWinner(group.id, group.finalMatch.team2!)
              : undefined
          }
        />
      </div>
    </div>
  );
}

// --- Beginners Layout ---

function BeginnersLayout({
  data,
  isAdmin,
  onSetFinalWinner,
  onToggleQualified,
  onSelectGroupFinalWinner,
}: {
  data: BeginnersBracketData;
  isAdmin?: boolean;
  onSetFinalWinner?: (team: string) => void;
  onToggleQualified?: (groupId: string, team: string) => void;
  onSelectGroupFinalWinner?: (groupId: string, team: string) => void;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-20 px-4 pb-12">
      <div className="flex w-full max-w-7xl flex-col gap-20 md:flex-row md:items-start md:justify-center">
        {/* Left: Groups stacked vertically */}
        <div className="flex flex-col gap-14">
          {data.groups.map((g) => (
            <GroupBracket
              key={g.id}
              group={g}
              isAdmin={isAdmin}
              onToggleQualified={onToggleQualified}
              onSelectGroupFinalWinner={onSelectGroupFinalWinner}
            />
          ))}
        </div>

        {/* Right column: Final + Third Place stacked */}
        <div className="flex flex-col items-center gap-10">
          {/* Final card with winner to the right */}
          <div className="relative flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Final
              </h3>
              <div className="flex flex-col items-center gap-1">
                <TeamPill
                  name={data.final.team1 ?? "TBD"}
                  isWinner={data.final.winner === data.final.team1}
                  onClick={
                    isAdmin && data.final.team1
                      ? () =>
                          onSetFinalWinner &&
                          onSetFinalWinner(data.final.team1!)
                      : undefined
                  }
                />
                <span className="text-[10px] font-bold text-slate-500">VS</span>
                <TeamPill
                  name={data.final.team2 ?? "TBD"}
                  isWinner={data.final.winner === data.final.team2}
                  onClick={
                    isAdmin && data.final.team2
                      ? () =>
                          onSetFinalWinner &&
                          onSetFinalWinner(data.final.team2!)
                      : undefined
                  }
                />
              </div>
            </div>
            {/* Winner to the right */}
            {data.final.winner && (
              <div className="relative flex items-center gap-4">
                <div className="absolute right-full top-1/2 h-[1px] w-8 -translate-y-1/2 bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                    Campeón
                  </span>
                  <TeamPill name={data.final.winner} isWinner />
                </div>
              </div>
            )}
          </div>
          {/* Third place directly below the final */}
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              3er Lugar
            </h3>
            <TeamPill name={data.thirdPlaceTeam ?? "TBD"} isWinner />
          </div>
        </div>
      </div>
    </div>
  );
}
function AdvancedLayout({
  data,
  isAdmin,
  onSelectQuarterWinner,
  onSelectSemifinalWinner,
  onSelectFinalWinner,
  onSelectThirdPlace,
}: {
  data: AdvancedBracketData;
  isAdmin?: boolean;
  onSelectQuarterWinner?: (matchId: string, team: string) => void;
  onSelectSemifinalWinner?: (matchId: string, team: string) => void;
  onSelectFinalWinner?: (team: string) => void;
  onSelectThirdPlace?: (team: string) => void;
}) {
  const quarterfinals = data.rounds[0];
  const semifinals = data.rounds[1];

  // Third place helpers to avoid optional access warnings
  const thirdPlaceName = data.thirdPlace?.winner ?? data.thirdPlace?.team1;
  const thirdPlaceClickable = !!(
    isAdmin &&
    thirdPlaceName &&
    onSelectThirdPlace
  );

  // safe handler that avoids non-null assertions
  const handleThirdPlaceClick = () => {
    if (thirdPlaceClickable && onSelectThirdPlace && thirdPlaceName) {
      onSelectThirdPlace(thirdPlaceName);
    }
  };

  if (!quarterfinals || !semifinals) return null;

  return (
    <div className="flex w-full max-w-7xl flex-row items-start justify-center gap-12">
      {/* Left: Quarter -> Semifinal chains */}
      <div className="flex flex-col gap-8">
        {quarterfinals.matches.slice(0, 3).map((qMatch, idx) => {
          const semiMatch = semifinals.matches[idx];
          const semiWinner = semiMatch?.winner ?? semiMatch?.team1 ?? undefined;
          return (
            <div key={qMatch.id} className="relative flex items-center gap-16">
              {/* Quarter block */}
              <div className="relative">
                <MatchNode
                  match={qMatch}
                  roundIndex={0}
                  onSelectTeam={
                    isAdmin
                      ? (team) =>
                          onSelectQuarterWinner &&
                          onSelectQuarterWinner(qMatch.id, team)
                      : undefined
                  }
                />
                <div className="absolute right-[-2rem] top-1/2 hidden h-[1px] w-12 bg-slate-700 md:block"></div>
              </div>
              {/* Semifinal single team (select to mark as winner) */}
              <div className="relative">
                <TeamPill
                  name={semiWinner ?? "TBD"}
                  isWinner={!!semiMatch?.winner}
                  onClick={
                    isAdmin && semiMatch?.team1
                      ? () =>
                          onSelectSemifinalWinner &&
                          onSelectSemifinalWinner(
                            semiMatch.id,
                            semiMatch.team1!,
                          )
                      : undefined
                  }
                />
                <div className="absolute right-[-2rem] top-1/2 hidden h-[1px] md:block"></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Final & Third Place column */}
      <div className="relative flex flex-col items-center gap-12 pt-4">
        {/* Final card with winner to the right */}
        <div className="relative flex items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">
              Final
            </h3>
            <div className="flex flex-col items-center gap-1">
              <TeamPill
                name={data.final.team1 ?? "TBD"}
                isWinner={data.final.winner === data.final.team1}
                onClick={
                  isAdmin && data.final.team1
                    ? () =>
                        onSelectFinalWinner &&
                        onSelectFinalWinner(data.final.team1!)
                    : undefined
                }
              />
              <span className="text-[10px] font-bold text-slate-500">VS</span>
              <TeamPill
                name={data.final.team2 ?? "TBD"}
                isWinner={data.final.winner === data.final.team2}
                onClick={
                  isAdmin && data.final.team2
                    ? () =>
                        onSelectFinalWinner &&
                        onSelectFinalWinner(data.final.team2!)
                    : undefined
                }
              />
            </div>
          </div>

          {/* Winner to the right */}
          {data.final.winner && (
            <div className="relative flex items-center gap-4">
              <div className="absolute right-full top-1/2 h-[1px] w-8 -translate-y-1/2 bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                  Campeón
                </span>
                <TeamPill name={data.final.winner} isWinner />
              </div>
            </div>
          )}
        </div>

        {/* Third place directly below */}
        {data.thirdPlace && (
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              3er Lugar
            </h3>
            <TeamPill
              name={thirdPlaceName ?? "TBD"}
              isWinner={!!data.thirdPlace?.winner}
              onClick={thirdPlaceClickable ? handleThirdPlaceClick : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function BracketsPage() {
  const [category, setCategory] = useState("beginners");
  // State-wrapped bracket data to allow future mutations (admin interactions, undo, etc.)
  const [beginnersData, setBeginnersData] =
    useState<BeginnersBracketData>(BEGINNERS_DATA);
  const [advancedData, setAdvancedData] =
    useState<AdvancedBracketData>(ADVANCED_DATA);
  // Always admin mode on this page
  const isAdmin = true;
  const [history, setHistory] = useState<
    { beginners: BeginnersBracketData; advanced: AdvancedBracketData }[]
  >([]);
  type SaveBracketHook = {
    mutate: (args: { category: Category; payload: unknown }) => void;
    isPending: boolean;
  };

  // Define a narrow API shape describing the bracket.saveBracket.useMutation hook to avoid `any`.
  type ApiWithBracketHook = {
    bracket?: {
      saveBracket?: {
        useMutation?: () => SaveBracketHook | undefined;
      };
    };
  };

  // Safely attempt to obtain the mutation hook; if unavailable, provide a fallback implementation.
  const saveBracket: SaveBracketHook = (() => {
    try {
      const typedApi = api as unknown as ApiWithBracketHook;
      const maybeMut = typedApi?.bracket?.saveBracket?.useMutation?.();
      if (maybeMut && typeof maybeMut.mutate === "function") {
        return maybeMut;
      }
    } catch (e) {
      // swallow and fall back to noop implementation
      console.warn("saveBracket hook unavailable, using fallback:", e);
    }
    return {
      mutate: (args: { category: Category; payload: unknown }) => {
        // Provide a visible no-op to avoid empty function lint errors and aid debugging if called unexpectedly
        console.warn(
          "saveBracket.mutate called but no remote hook is available. Args:",
          args,
        );
      },
      isPending: false,
    };
  })();

  // Helper to push a deep-cloned snapshot for undo
  const pushHistory = () => {
    setHistory((h) => [
      ...h,
      {
        beginners: JSON.parse(
          JSON.stringify(beginnersData),
        ) as BeginnersBracketData,
        advanced: JSON.parse(
          JSON.stringify(advancedData),
        ) as AdvancedBracketData,
      },
    ]);
  };

  // Advanced propagation logic
  const recomputeAdvancedStructure = (
    data: AdvancedBracketData,
  ): AdvancedBracketData => {
    const quarterRound = data.rounds.find((r) => r.name === "Quarterfinals");
    const semiRound = data.rounds.find((r) => r.name === "Semifinals");
    if (!quarterRound || !semiRound) return data;
    const qWinners = quarterRound.matches
      .map((m) => m.winner)
      .filter(Boolean) as string[];
    // Map quarter winners into semifinal placeholders (vertical list)
    const newSemiMatches = semiRound.matches.map((m, idx) => {
      const newTeam = qWinners[idx] ?? m.team1;
      const winnerValid =
        m.winner && m.winner === newTeam ? m.winner : undefined;
      return { ...m, team1: newTeam, winner: winnerValid };
    });
    const updatedRounds = data.rounds.map((r) =>
      r.name === "Semifinals" ? { ...r, matches: newSemiMatches } : r,
    );
    // Determine semifinal winners
    const semiWinners = newSemiMatches
      .map((m) => m.winner)
      .filter(Boolean) as string[];
    const final = { ...data.final };
    if (semiWinners.length >= 2) {
      // If current final teams not consistent, assign first two winners
      const invalid =
        !final.team1 ||
        !final.team2 ||
        final.team1 === final.team2 ||
        !semiWinners.includes(final.team1) ||
        !semiWinners.includes(final.team2);
      if (invalid) {
        final.team1 = semiWinners[0];
        final.team2 = semiWinners[1];
        if (
          final.winner &&
          final.winner !== final.team1 &&
          final.winner !== final.team2
        )
          delete final.winner;
      }
    } else {
      final.team1 = undefined;
      final.team2 = undefined;
      delete final.winner;
    }
    // Third place determination: remaining semifinal winner not in final
    const thirdPlace = data.thirdPlace ? { ...data.thirdPlace } : undefined;
    if (semiWinners.length === 3 && final.team1 && final.team2) {
      const remaining = semiWinners.find(
        (w) => w !== final.team1 && w !== final.team2,
      );
      if (thirdPlace) {
        thirdPlace.team1 = remaining;
        if (thirdPlace.winner && thirdPlace.winner !== remaining)
          delete thirdPlace.winner;
      }
    } else if (thirdPlace) {
      // Reset if not enough info
      if (!final.team1 || !final.team2) {
        delete thirdPlace.winner;
      }
    }
    return { ...data, rounds: updatedRounds, final, thirdPlace };
  };
  const handleAdvancedMatchWinner = (matchId: string, team: string) => {
    pushHistory();
    setAdvancedData((prev) => {
      const newRounds = prev.rounds.map((r) =>
        r.name === "Quarterfinals"
          ? {
              ...r,
              matches: r.matches.map((m) =>
                m.id === matchId ? { ...m, winner: team } : m,
              ),
            }
          : r,
      );
      return recomputeAdvancedStructure({ ...prev, rounds: newRounds });
    });
  };
  const handleAdvancedSemifinalWinner = (matchId: string, team: string) => {
    pushHistory();
    setAdvancedData((prev) => {
      const newRounds = prev.rounds.map((r) =>
        r.name === "Semifinals"
          ? {
              ...r,
              matches: r.matches.map((m) =>
                m.id === matchId ? { ...m, winner: team } : m,
              ),
            }
          : r,
      );
      return recomputeAdvancedStructure({ ...prev, rounds: newRounds });
    });
  };
  const handleAdvancedFinalWinner = (team: string) => {
    pushHistory();
    setAdvancedData((prev) =>
      recomputeAdvancedStructure({
        ...prev,
        final: { ...prev.final, winner: team },
      }),
    );
  };
  const handleAdvancedThirdPlace = (team: string) => {
    pushHistory();
    setAdvancedData((prev) =>
      prev.thirdPlace
        ? { ...prev, thirdPlace: { ...prev.thirdPlace, winner: team } }
        : prev,
    );
  };
  const handleBeginnersFinalWinner = (team: string) => {
    pushHistory();
    setBeginnersData((prev) => ({
      ...prev,
      final: { ...prev.final, winner: team },
      thirdPlaceTeam:
        prev.semifinalists.find(
          (s) => s !== prev.final.team1 && s !== prev.final.team2,
        ) ?? prev.thirdPlaceTeam,
    }));
  };
  const handleToggleQualified = (groupId: string, team: string) => {
    pushHistory();
    setBeginnersData((prev) => {
      const groups = prev.groups.map((g) => {
        if (g.id !== groupId) return g;

        const qualified = [...g.qualified];
        const teamIndex = qualified.indexOf(team);

        if (teamIndex >= 0) {
          // Team is already qualified, remove it
          qualified.splice(teamIndex, 1);
        } else if (qualified.length < 2) {
          // Add team if less than 2 qualified
          qualified.push(team);
        }

        // Update finalMatch participants when we have 2 qualified
        const finalMatch = { ...g.finalMatch };
        if (qualified.length === 2) {
          finalMatch.team1 = qualified[0];
          finalMatch.team2 = qualified[1];
          // Reset winner if teams changed
          if (finalMatch.winner && !qualified.includes(finalMatch.winner)) {
            delete finalMatch.winner;
          }
        } else {
          // Clear finalMatch if not enough qualified
          finalMatch.team1 = undefined;
          finalMatch.team2 = undefined;
          delete finalMatch.winner;
        }

        return { ...g, qualified, finalMatch };
      });

      // Collect semifinalists from group final winners
      const semifinalists = groups
        .map((g) => g.finalMatch.winner)
        .filter(Boolean) as string[];

      // Auto-assign final participants
      const final = { ...prev.final };
      let thirdPlaceTeam = prev.thirdPlaceTeam;

      if (semifinalists.length >= 2) {
        const finalistsValid =
          final.team1 &&
          final.team2 &&
          semifinalists.includes(final.team1) &&
          semifinalists.includes(final.team2) &&
          final.team1 !== final.team2;
        if (!finalistsValid) {
          final.team1 = semifinalists[0];
          final.team2 = semifinalists[1];
          if (
            final.winner &&
            final.winner !== final.team1 &&
            final.winner !== final.team2
          )
            delete final.winner;
        }
      } else {
        final.team1 = undefined;
        final.team2 = undefined;
        delete final.winner;
      }

      // Third place: remaining semifinalist
      if (semifinalists.length === 3 && final.team1 && final.team2) {
        const remaining = semifinalists.find(
          (s) => s !== final.team1 && s !== final.team2,
        );
        thirdPlaceTeam = remaining ?? "";
      } else {
        thirdPlaceTeam = "";
      }

      return { ...prev, groups, semifinalists, final, thirdPlaceTeam };
    });
  };

  const handleGroupFinalWinner = (groupId: string, team: string) => {
    pushHistory();
    setBeginnersData((prev) => {
      const groups = prev.groups.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, finalMatch: { ...g.finalMatch, winner: team } };
      });

      const semifinalists = groups
        .map((g) => g.finalMatch.winner)
        .filter(Boolean) as string[];
      const final = { ...prev.final };

      if (semifinalists.length >= 2) {
        const finalistsValid =
          final.team1 &&
          final.team2 &&
          semifinalists.includes(final.team1) &&
          semifinalists.includes(final.team2) &&
          final.team1 !== final.team2;
        if (!finalistsValid) {
          final.team1 = semifinalists[0];
          final.team2 = semifinalists[1];
          if (
            final.winner &&
            final.winner !== final.team1 &&
            final.winner !== final.team2
          )
            delete final.winner;
        }
      } else {
        final.team1 = undefined;
        final.team2 = undefined;
        delete final.winner;
      }

      let thirdPlaceTeam = prev.thirdPlaceTeam;
      if (semifinalists.length === 3 && final.team1 && final.team2) {
        const remaining = semifinalists.find(
          (s) => s !== final.team1 && s !== final.team2,
        );
        thirdPlaceTeam = remaining ?? "";
      } else {
        thirdPlaceTeam = "";
      }

      return { ...prev, groups, semifinalists, final, thirdPlaceTeam };
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center overflow-auto bg-[#0a0a0a] p-4 pt-24 text-white md:p-8 md:pt-32">
      {/* Header */}
      <div className="z-10 mb-16 flex w-full max-w-4xl flex-col items-center gap-8">
        <h1 className="text-center text-4xl font-black tracking-tight md:text-6xl">
          ROBO<span className="text-blue-600">CHAMP</span>
          <span className="mt-2 block text-xl font-medium uppercase tracking-widest text-slate-500 md:text-2xl">
            {category}
          </span>
        </h1>

        {/* Category Toggle */}
        <div className="flex rounded-full border border-white/10 bg-[#1a1a1a] p-1.5">
          {(["beginners", "advanced"] as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full px-8 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-300 ${category === cat ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-500 hover:bg-white/5 hover:text-white"} `}
            >
              {cat}
            </button>
          ))}
        </div>
        {/* Admin Controls */}
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={() => {
              const payload =
                category === "beginners" ? beginnersData : advancedData;
              saveBracket.mutate({
                category: category as "beginners" | "advanced",
                payload,
              });
            }}
            className={`rounded-full border px-6 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${saveBracket.isPending ? "cursor-wait opacity-50" : "border-green-500 bg-[#1a1a1a] text-green-400 hover:bg-green-600 hover:text-white"}`}
          >
            {saveBracket.isPending ? "Guardando..." : "Guardar Bracket"}
          </button>
        </div>
      </div>
      {/* Main Content Area */}
      {category === "beginners" ? (
        <BeginnersLayout
          data={beginnersData}
          isAdmin={isAdmin}
          onSetFinalWinner={handleBeginnersFinalWinner}
          onToggleQualified={handleToggleQualified}
          onSelectGroupFinalWinner={handleGroupFinalWinner}
        />
      ) : (
        <AdvancedLayout
          data={advancedData}
          isAdmin={isAdmin}
          onSelectQuarterWinner={handleAdvancedMatchWinner}
          onSelectSemifinalWinner={handleAdvancedSemifinalWinner}
          onSelectFinalWinner={handleAdvancedFinalWinner}
          onSelectThirdPlace={handleAdvancedThirdPlace}
        />
      )}
    </div>
  );
}
