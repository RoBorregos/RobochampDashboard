"use client";

import { BracketCategory, Role } from "@prisma/client";
import { createContext, useContext, useState, useEffect } from "react";
import { api } from "~/trpc/react";
import LogoLoader from "~/app/_components/logo-loader";
import Header from "~/app/_components/header";

type Category = BracketCategory;

interface Match {
  id: string;
  team1?: string;
  team2?: string;
  team3?: string;
  teams?: string[];
  winner?: string;
}

interface Round {
  name: string;
  matches: Match[];
}

interface AdvancedBracketData {
  rounds: Round[];
  final: Match;
  thirdPlace?: Match;
  winner?: string;
}

interface Group {
  id: string;
  name: string;
  teams: string[];
  qualified: string[];
  finalMatch: Match;
}

interface BeginnersBracketData {
  groups: Group[];
  semifinalists: string[];
  final: Match;
  thirdPlaceTeam: string;
}

const GROUP_COUNT = 3;
const QUARTER_COUNT = 3;

// Deals teams round-robin so pools stay balanced whatever the team count.
const deal = (teams: string[], pools: number) =>
  Array.from({ length: pools }, (_, i) =>
    teams.filter((_, idx) => idx % pools === i),
  );

const buildBeginnersData = (teams: string[]): BeginnersBracketData => ({
  groups: deal(teams, GROUP_COUNT).map((pool, i) => {
    const id = `g${String.fromCharCode(97 + i)}`;
    return {
      id,
      name: `Grupo ${String.fromCharCode(65 + i)}`,
      teams: pool,
      qualified: [],
      finalMatch: { id: `${id}_final` },
    };
  }),
  semifinalists: [],
  final: { id: "beg_final" },
  thirdPlaceTeam: "",
});

const buildAdvancedData = (teams: string[]): AdvancedBracketData => ({
  rounds: [
    {
      name: "Quarterfinals",
      matches: deal(teams, QUARTER_COUNT).map((pool, i) => ({
        id: `aq${i + 1}`,
        teams: pool,
      })),
    },
    {
      name: "Semifinals",
      matches: Array.from({ length: QUARTER_COUNT }, (_, i) => ({
        id: `as${i + 1}`,
      })),
    },
  ],
  final: { id: "af" },
  thirdPlace: { id: "atp" },
});

// Team name -> total points from the scoreboard (respects the freeze).
const ScoresContext = createContext<Record<string, number>>({});

type Slot = {
  name?: string;
  won?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

// Google-style match card: stacked team rows, winner highlighted, losers dimmed.
function MatchCard({
  slots,
  label,
  accent,
}: {
  slots: Slot[];
  label?: string;
  accent?: boolean;
}) {
  const decided = slots.some((s) => s.won);
  const scores = useContext(ScoresContext);
  return (
    <div className="w-full">
      {(label || decided) && (
        <div className="mb-1 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <span>{label}</span>
          {decided && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">
              FT
            </span>
          )}
        </div>
      )}
      <div
        className={`overflow-hidden rounded-xl border bg-[#141414] ${accent ? "border-blue-500/60" : "border-white/10"}`}
      >
        {slots.map((s, i) => {
          const clickable = !!s.onClick && !s.disabled;
          return (
            <button
              key={`${s.name ?? "empty"}-${i}`}
              type="button"
              disabled={!clickable}
              onClick={clickable ? s.onClick : undefined}
              className={`flex h-9 w-full items-center justify-between gap-2 border-l-4 px-3 text-left text-sm ${i > 0 ? "border-t border-t-white/5" : ""} ${
                s.won
                  ? "border-l-blue-500 bg-blue-600/20 font-bold text-white"
                  : `border-l-transparent ${decided ? "text-slate-500" : "text-slate-300"}`
              } ${clickable ? "cursor-pointer hover:bg-white/5" : "cursor-default"}`}
            >
              <span className="truncate">
                {s.name || <span className="text-slate-600">—</span>}
              </span>
              {s.name && (
                <span className="flex items-center gap-1 tabular-nums">
                  {scores[s.name] ?? 0}
                  <span
                    className={`w-2 text-xs text-white ${s.won ? "" : "invisible"}`}
                  >
                    ◂
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// One round column: title on top, equal-height rows so cards line up with the connectors.
function RoundColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-52 shrink-0 snap-start flex-col sm:w-56">
      <h3 className="flex h-8 items-center justify-center text-[11px] font-bold uppercase tracking-widest text-blue-400">
        {title}
      </h3>
      <div className="grid flex-1 items-center" style={{ gridAutoRows: "1fr" }}>
        {children}
      </div>
    </div>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="relative flex items-center py-2">{children}</div>
);

// Elbow connectors from `from` evenly spaced rows to `to` evenly spaced rows.
function Links({ from, to }: { from: number; to: number }) {
  const y = (i: number, n: number) => ((i + 0.5) / n) * 100;
  const d = Array.from({ length: from }, (_, i) => {
    const t = Math.min(to - 1, Math.floor((i * to) / from));
    return `M0 ${y(i, from)}H12V${y(t, to)}H24`;
  }).join("");
  return (
    <div className="flex w-6 shrink-0 flex-col sm:w-10">
      <div className="h-8" />
      <svg
        className="min-h-0 w-full flex-1"
        viewBox="0 0 24 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={d}
          fill="none"
          stroke="#3b82f6"
          strokeOpacity={0.45}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

// Horizontally swipeable on phones (snaps per round); centered on desktop.
function BracketScroller({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-7xl snap-x snap-mandatory overflow-x-auto px-4 pb-8 [scrollbar-width:thin]">
      <div className="mx-auto flex w-max">{children}</div>
    </div>
  );
}

function FinalColumn({
  final,
  thirdPlace,
  onSelectFinalWinner,
  onSelectThirdPlace,
  isAdmin,
}: {
  final: Match;
  thirdPlace: Slot;
  onSelectFinalWinner?: (team: string) => void;
  onSelectThirdPlace?: () => void;
  isAdmin?: boolean;
}) {
  const slot = (team?: string): Slot => ({
    name: team,
    won: !!team && final.winner === team,
    onClick:
      isAdmin && team && onSelectFinalWinner
        ? () => onSelectFinalWinner(team)
        : undefined,
  });
  return (
    <>
      <RoundColumn title="Final">
        <Row>
          <MatchCard accent slots={[slot(final.team1), slot(final.team2)]} />
          <div className="absolute inset-x-0 top-full -mt-2 pt-6">
            <MatchCard
              label="3er Lugar"
              slots={[
                {
                  ...thirdPlace,
                  onClick: isAdmin ? onSelectThirdPlace : undefined,
                },
              ]}
            />
          </div>
        </Row>
      </RoundColumn>
      <Links from={1} to={1} />
      <RoundColumn title="Campeón">
        <Row>
          <MatchCard
            accent
            slots={[{ name: final.winner, won: !!final.winner }]}
          />
        </Row>
      </RoundColumn>
    </>
  );
}

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
  const n = data.groups.length;
  return (
    <BracketScroller>
      <RoundColumn title="Grupos">
        {data.groups.map((g) => (
          <Row key={g.id}>
            <MatchCard
              label={g.name}
              slots={g.teams.map((team) => ({
                name: team,
                won: g.qualified.includes(team),
                disabled: !!g.finalMatch.winner,
                onClick: isAdmin
                  ? () => onToggleQualified?.(g.id, team)
                  : undefined,
              }))}
            />
          </Row>
        ))}
      </RoundColumn>
      <Links from={n} to={n} />
      <RoundColumn title="Final de grupo">
        {data.groups.map((g) => (
          <Row key={g.id}>
            <MatchCard
              slots={[g.finalMatch.team1, g.finalMatch.team2].map((team) => ({
                name: team,
                won: !!team && g.finalMatch.winner === team,
                disabled: !!g.finalMatch.winner,
                onClick:
                  isAdmin && team
                    ? () => onSelectGroupFinalWinner?.(g.id, team)
                    : undefined,
              }))}
            />
          </Row>
        ))}
      </RoundColumn>
      <Links from={n} to={1} />
      <FinalColumn
        final={data.final}
        isAdmin={isAdmin}
        onSelectFinalWinner={onSetFinalWinner}
        thirdPlace={{ name: data.thirdPlaceTeam }}
      />
    </BracketScroller>
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
  if (!quarterfinals || !semifinals) return null;

  const n = quarterfinals.matches.length;
  const thirdName = data.thirdPlace?.winner ?? data.thirdPlace?.team1;

  return (
    <BracketScroller>
      <RoundColumn title="Cuartos">
        {quarterfinals.matches.map((q) => (
          <Row key={q.id}>
            <MatchCard
              slots={(
                q.teams ?? [q.team1, q.team2, q.team3].filter(Boolean)
              ).map((team) => ({
                name: team,
                won: q.winner === team,
                onClick: isAdmin
                  ? () => onSelectQuarterWinner?.(q.id, team!)
                  : undefined,
              }))}
            />
          </Row>
        ))}
      </RoundColumn>
      <Links from={n} to={n} />
      <RoundColumn title="Semifinales">
        {semifinals.matches.map((s) => (
          <Row key={s.id}>
            <MatchCard
              slots={[
                {
                  name: s.winner ?? s.team1,
                  won: !!s.winner,
                  onClick:
                    isAdmin && s.team1
                      ? () => onSelectSemifinalWinner?.(s.id, s.team1!)
                      : undefined,
                },
              ]}
            />
          </Row>
        ))}
      </RoundColumn>
      <Links from={n} to={1} />
      <FinalColumn
        final={data.final}
        isAdmin={isAdmin}
        onSelectFinalWinner={onSelectFinalWinner}
        thirdPlace={{ name: thirdName, won: !!data.thirdPlace?.winner }}
        onSelectThirdPlace={
          thirdName ? () => onSelectThirdPlace?.(thirdName) : undefined
        }
      />
    </BracketScroller>
  );
}

export default function BracketsClient({ userRole }: { userRole?: Role }) {
  const [category, setCategory] = useState<Category>(BracketCategory.BEGINNERS);
  const [beginnersData, setBeginnersData] = useState<BeginnersBracketData>(
    buildBeginnersData([]),
  );
  const [advancedData, setAdvancedData] = useState<AdvancedBracketData>(
    buildAdvancedData([]),
  );

  // Check if user is admin
  const isAdmin = userRole === Role.ADMIN;

  // Load saved bracket data (public - anyone can view)
  const { data: savedBeginnersData } = api.bracket.getBracket.useQuery({
    category: BracketCategory.BEGINNERS,
  });
  const { data: savedAdvancedData } = api.bracket.getBracket.useQuery({
    category: BracketCategory.ADVANCED,
  });

  // Teams come from the DB; they seed the bracket until one is saved.
  const { data: beginnersTeams } = api.bracket.getTeams.useQuery({
    category: BracketCategory.BEGINNERS,
  });
  const { data: advancedTeams } = api.bracket.getTeams.useQuery({
    category: BracketCategory.ADVANCED,
  });

  useEffect(() => {
    if (beginnersTeams && savedBeginnersData === null)
      setBeginnersData(buildBeginnersData(beginnersTeams));
  }, [beginnersTeams, savedBeginnersData]);

  useEffect(() => {
    if (advancedTeams && savedAdvancedData === null)
      setAdvancedData(buildAdvancedData(advancedTeams));
  }, [advancedTeams, savedAdvancedData]);

  // Initialize with saved data when loaded
  useEffect(() => {
    if (savedBeginnersData) {
      const data = savedBeginnersData as unknown as BeginnersBracketData;
      // Ensure qualified array is synced with finalMatch teams
      const normalizedData = {
        ...data,
        groups: data.groups.map((g) => {
          const qualified = [...g.qualified];
          // If finalMatch has teams but qualified is empty/incomplete, rebuild it
          if (g.finalMatch.team1 && g.finalMatch.team2) {
            const team1InQualified = qualified.includes(g.finalMatch.team1);
            const team2InQualified = qualified.includes(g.finalMatch.team2);
            if (!team1InQualified || !team2InQualified) {
              const newQualified = [g.finalMatch.team1, g.finalMatch.team2];
              return { ...g, qualified: newQualified };
            }
          }
          return g;
        }),
      };
      setBeginnersData(normalizedData);
    }
  }, [savedBeginnersData]);

  useEffect(() => {
    if (savedAdvancedData) {
      setAdvancedData(savedAdvancedData as unknown as AdvancedBracketData);
    }
  }, [savedAdvancedData]);

  const { data: scoreboard } = api.scoreboard.getScoreboard.useQuery();
  const scores = Object.fromEntries(
    (scoreboard ?? []).map((t) => [t.teamName, t.total]),
  );

  const saveBracket = api.bracket.saveBracket.useMutation({
    onSuccess: () => {
      alert("Bracket guardado exitosamente!");
    },
    onError: (error) => {
      alert(`Error al guardar: ${error.message}`);
    },
  });

  // Advanced bracket handlers
  const handleAdvancedMatchWinner = (matchId: string, team: string) => {
    setAdvancedData((prev) => {
      // Update quarterfinal winner
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

      // Get all quarter winners and update semifinals
      const quarterRound = newRounds.find((r) => r.name === "Quarterfinals");
      const qWinners =
        quarterRound?.matches.map((m) => m.winner).filter(Boolean) ?? [];

      const updatedRounds = newRounds.map((r) =>
        r.name === "Semifinals"
          ? {
              ...r,
              matches: r.matches.map((m, idx) => ({
                ...m,
                team1: qWinners[idx] ?? m.team1,
              })),
            }
          : r,
      );

      // Get semi winners and update final
      const semiRound = updatedRounds.find((r) => r.name === "Semifinals");
      const semiWinners =
        semiRound?.matches.map((m) => m.winner).filter(Boolean) ?? [];

      const final = { ...prev.final };
      if (semiWinners.length >= 2) {
        final.team1 = semiWinners[0];
        final.team2 = semiWinners[1];
      }

      // Third place gets remaining semi winner
      const thirdPlace = prev.thirdPlace ? { ...prev.thirdPlace } : undefined;
      if (thirdPlace && semiWinners.length === 3) {
        thirdPlace.team1 = semiWinners[2];
      }

      return { ...prev, rounds: updatedRounds, final, thirdPlace };
    });
  };

  const handleAdvancedSemifinalWinner = (matchId: string, team: string) => {
    setAdvancedData((prev) => {
      // Update semifinal winner
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

      // Get semi winners and update final
      const semiRound = newRounds.find((r) => r.name === "Semifinals");
      const semiWinners =
        semiRound?.matches.map((m) => m.winner).filter(Boolean) ?? [];

      const final = { ...prev.final };
      if (semiWinners.length >= 2) {
        final.team1 = semiWinners[0];
        final.team2 = semiWinners[1];
      }

      // Third place gets remaining semi winner
      const thirdPlace = prev.thirdPlace ? { ...prev.thirdPlace } : undefined;
      if (thirdPlace && semiWinners.length === 3) {
        thirdPlace.team1 = semiWinners[2];
      }

      return { ...prev, rounds: newRounds, final, thirdPlace };
    });
  };

  const handleAdvancedFinalWinner = (team: string) => {
    setAdvancedData((prev) => ({
      ...prev,
      final: { ...prev.final, winner: team },
    }));
  };

  const handleAdvancedThirdPlace = (team: string) => {
    setAdvancedData((prev) =>
      prev.thirdPlace
        ? { ...prev, thirdPlace: { ...prev.thirdPlace, winner: team } }
        : prev,
    );
  };

  // Beginners bracket handlers
  const handleBeginnersFinalWinner = (team: string) => {
    setBeginnersData((prev) => ({
      ...prev,
      final: { ...prev.final, winner: team },
    }));
  };

  const handleToggleQualified = (groupId: string, team: string) => {
    setBeginnersData((prev) => {
      const groups = prev.groups.map((g) => {
        if (g.id !== groupId) return g;

        // Don't allow changes if group final winner is already set
        if (g.finalMatch.winner) return g;

        const qualified = [...g.qualified];
        const teamIndex = qualified.indexOf(team);

        if (teamIndex >= 0) {
          qualified.splice(teamIndex, 1);
        } else if (qualified.length < 2) {
          qualified.push(team);
        }

        const finalMatch = { ...g.finalMatch };
        if (qualified.length === 2) {
          finalMatch.team1 = qualified[0];
          finalMatch.team2 = qualified[1];
          if (finalMatch.winner && !qualified.includes(finalMatch.winner)) {
            delete finalMatch.winner;
          }
        } else if (qualified.length < 2) {
          // Only clear finalMatch if we don't have 2 qualified teams
          // This prevents clearing on reload when finalMatch exists
          if (!finalMatch.team1 || !finalMatch.team2) {
            finalMatch.team1 = undefined;
            finalMatch.team2 = undefined;
            delete finalMatch.winner;
          }
        }

        return { ...g, qualified, finalMatch };
      });

      // Get group final winners and update main final
      const groupWinners = groups
        .map((g) => g.finalMatch.winner)
        .filter(Boolean) as string[];

      const final = { ...prev.final };
      if (groupWinners.length >= 2) {
        final.team1 = groupWinners[0];
        final.team2 = groupWinners[1];
      }

      const thirdPlaceTeam =
        groupWinners.length === 3 ? (groupWinners[2] ?? "") : "";

      return { ...prev, groups, final, thirdPlaceTeam };
    });
  };

  const handleGroupFinalWinner = (groupId: string, team: string) => {
    setBeginnersData((prev) => {
      const groups = prev.groups.map((g) => {
        // Don't allow changing winner if already set
        if (g.id === groupId && !g.finalMatch.winner) {
          return { ...g, finalMatch: { ...g.finalMatch, winner: team } };
        }
        return g;
      });

      // Get group final winners and update main final
      const groupWinners = groups
        .map((g) => g.finalMatch.winner)
        .filter(Boolean) as string[];

      const final = { ...prev.final };
      if (groupWinners.length >= 2) {
        final.team1 = groupWinners[0];
        final.team2 = groupWinners[1];
      }

      const thirdPlaceTeam =
        groupWinners.length === 3 ? (groupWinners[2] ?? "") : "";

      return { ...prev, groups, final, thirdPlaceTeam };
    });
  };

  if (
    savedBeginnersData === undefined ||
    savedAdvancedData === undefined ||
    !beginnersTeams ||
    !advancedTeams
  )
    return <LogoLoader />;

  return (
    <div className="flex min-h-screen flex-col items-center overflow-auto bg-[#0a0a0a] p-4 pt-24 text-white md:p-8 md:pt-32">
      {/* Unified header style */}
      <div className="z-10 mb-8 flex w-full max-w-5xl flex-col items-center">
        <Header title="ROBOCHAMP" subtitle={category.toUpperCase()} />
        {/* Category Toggle */}
        <div className="-mt-10 flex rounded-full border border-white/10 bg-[#1a1a1a] p-1.5">
          {(
            [BracketCategory.BEGINNERS, BracketCategory.ADVANCED] as Category[]
          ).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 md:px-8 md:py-3 md:text-sm ${category === cat ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-500 hover:bg-white/5 hover:text-white"} `}
            >
              {cat}
            </button>
          ))}
        </div>
        {/* Admin Controls - Only visible to admins */}
        {isAdmin && (
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={() => {
                if (category === BracketCategory.BEGINNERS) {
                  saveBracket.mutate({
                    category: BracketCategory.BEGINNERS,
                    payload: beginnersData,
                  });
                } else {
                  saveBracket.mutate({
                    category: BracketCategory.ADVANCED,
                    payload: advancedData,
                  });
                }
              }}
              className={`rounded-full border px-6 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${saveBracket.isPending ? "cursor-wait opacity-50" : "border-green-500 bg-[#1a1a1a] text-green-400 hover:bg-green-600 hover:text-white"}`}
            >
              {saveBracket.isPending ? "Guardando..." : "Guardar Bracket"}
            </button>
          </div>
        )}
      </div>
      {/* Main Content Area */}
      <ScoresContext.Provider value={scores}>
        {category === BracketCategory.BEGINNERS ? (
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
      </ScoresContext.Provider>
    </div>
  );
}
