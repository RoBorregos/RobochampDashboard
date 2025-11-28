"use client";

import { BracketCategory, Role } from "@prisma/client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import Header from "~/app/_components/header";

type Category = BracketCategory;

interface Match {
  id: string;
  team1?: string;
  team2?: string;
  team3?: string; 
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

const BEGINNERS_DATA: BeginnersBracketData = {
  groups: [
    {
      id: "ga",
      name: "Grupo A",
      teams: ["ALF4", "BrookieBot", "Clankers", "NullPointers", "Skibidy Circuits"],
      qualified: [],
      finalMatch: { id: "ga_final" },
    },
    {
      id: "gb",
      name: "Grupo B",
      teams: ["Alfa Team", "Búhos Team", "Dream Team", "Robocops", "0xDEADBOTS"],
      qualified: [],
      finalMatch: { id: "gb_final" },
    },
    {
      id: "gc",
      name: "Grupo C",
      teams: ["Aquilabots", "CheckMates", "Mecha Ryuu", "ROBO-HAWKS"],
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
          team1: "Aguilatronics",
          team2: "Cloud Robotics",
          team3: "Kairo",
        },
        {
          id: "aq2",
          team1: "Alebrijes",
          team2: "Delta",
          team3: "MecAlfa",
        },
        {
          id: "aq3",
          team1: "Botbusters",
          team2: "High Voltage",
          team3: "Noche interestelar",
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



function TeamPill({
  name,
  isWinner,
  small = false,
  onClick,
  disabled,
  variant,
}: {
  name?: string;
  isWinner?: boolean;
  small?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "blue" | "gray";
}) {
  const clickable = !!onClick && !disabled;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onClick : undefined}
      className={`relative flex select-none items-center justify-center ${small ? "h-10 w-32 text-xs" : "h-14 w-48 md:h-16 md:w-56"} rounded-2xl border transition-all duration-300 ${
        isWinner || variant === "blue"
          ? "z-10 scale-105 border-blue-400 bg-blue-600 font-bold text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]"
          : "border-[#333] bg-[#1a1a1a] text-slate-400"
      } ${clickable && !(isWinner || variant === "blue") ? "cursor-pointer hover:border-blue-400 hover:shadow-[0_0_8px_rgba(59,130,246,0.4)]" : ""} ${!clickable ? "opacity-60" : ""} `}
    >
      <span className="truncate px-4">{name ?? ""}</span>
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
          name={group.finalMatch.team1 ?? ""}
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
          name={group.finalMatch.team2 ?? ""}
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
                  name={data.final.team1 ?? ""}
                  variant="blue"
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
                  name={data.final.team2 ?? ""}
                  variant="blue"
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
            <TeamPill name={data.thirdPlaceTeam ?? ""} variant="blue" />
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

              </div>
              {/* Semifinal single team (select to mark as winner) */}
              <div className="relative">
                <TeamPill
                  name={semiWinner ?? ""}
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
                name={data.final.team1 ?? ""}
                variant="blue"
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
                name={data.final.team2 ?? ""}
                variant="blue"
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
              name={thirdPlaceName ?? ""}
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
  const { data: session, status } = useSession();
  const [category, setCategory] = useState<Category>(BracketCategory.BEGINNERS);
  const [beginnersData, setBeginnersData] =
    useState<BeginnersBracketData>(BEGINNERS_DATA);
  const [advancedData, setAdvancedData] =
    useState<AdvancedBracketData>(ADVANCED_DATA);

  // Check if user is admin
  const isAdmin = session?.user?.role === Role.ADMIN;

  // Load saved bracket data (public - anyone can view)
  const { data: savedBeginnersData } = api.bracket.getBracket.useQuery(
    { category: BracketCategory.BEGINNERS }
  );
  const { data: savedAdvancedData } = api.bracket.getBracket.useQuery(
    { category: BracketCategory.ADVANCED }
  );

  // Initialize with saved data when loaded
  useEffect(() => {
    if (savedBeginnersData) {
      setBeginnersData(savedBeginnersData as unknown as BeginnersBracketData);
    }
  }, [savedBeginnersData]);

  useEffect(() => {
    if (savedAdvancedData) {
      setAdvancedData(savedAdvancedData as unknown as AdvancedBracketData);
    }
  }, [savedAdvancedData]);

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
              m.id === matchId ? { ...m, winner: team } : m
            ),
          }
          : r
      );

      // Get all quarter winners and update semifinals
      const quarterRound = newRounds.find((r) => r.name === "Quarterfinals");
      const qWinners = quarterRound?.matches.map((m) => m.winner).filter(Boolean) ?? [];
      
      const updatedRounds = newRounds.map((r) =>
        r.name === "Semifinals"
          ? {
            ...r,
            matches: r.matches.map((m, idx) => ({
              ...m,
              team1: qWinners[idx] ?? m.team1,
            })),
          }
          : r
      );

      // Get semi winners and update final
      const semiRound = updatedRounds.find((r) => r.name === "Semifinals");
      const semiWinners = semiRound?.matches.map((m) => m.winner).filter(Boolean) ?? [];
      
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
              m.id === matchId ? { ...m, winner: team } : m
            ),
          }
          : r
      );

      // Get semi winners and update final
      const semiRound = newRounds.find((r) => r.name === "Semifinals");
      const semiWinners = semiRound?.matches.map((m) => m.winner).filter(Boolean) ?? [];
      
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
        : prev
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
        } else {
          finalMatch.team1 = undefined;
          finalMatch.team2 = undefined;
          delete finalMatch.winner;
        }

        return { ...g, qualified, finalMatch };
      });

      // Get group final winners and update main final
      const groupWinners = groups.map((g) => g.finalMatch.winner).filter(Boolean) as string[];
      
      const final = { ...prev.final };
      if (groupWinners.length >= 2) {
        final.team1 = groupWinners[0];
        final.team2 = groupWinners[1];
      }

      const thirdPlaceTeam = groupWinners.length === 3 ? (groupWinners[2] ?? "") : "";

      return { ...prev, groups, final, thirdPlaceTeam };
    });
  };

  const handleGroupFinalWinner = (groupId: string, team: string) => {
    setBeginnersData((prev) => {
      const groups = prev.groups.map((g) =>
        g.id === groupId
          ? { ...g, finalMatch: { ...g.finalMatch, winner: team } }
          : g
      );

      // Get group final winners and update main final
      const groupWinners = groups.map((g) => g.finalMatch.winner).filter(Boolean) as string[];
      
      const final = { ...prev.final };
      if (groupWinners.length >= 2) {
        final.team1 = groupWinners[0];
        final.team2 = groupWinners[1];
      }

      const thirdPlaceTeam = groupWinners.length === 3 ? (groupWinners[2] ?? "") : "";

      return { ...prev, groups, final, thirdPlaceTeam };
    });
  };

  // Show loading state while checking auth
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-white">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center overflow-auto bg-[#0a0a0a] p-4 pt-24 text-white md:p-8 md:pt-32">
      {/* Unified header style */}
      <div className="z-10 mb-8 flex w-full max-w-5xl flex-col items-center">
        <Header title="ROBOCHAMP" subtitle={category.toUpperCase()} />
        {/* Category Toggle */}
        <div className="-mt-10 flex rounded-full border border-white/10 bg-[#1a1a1a] p-1.5">
          {([BracketCategory.BEGINNERS, BracketCategory.ADVANCED] as Category[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full px-8 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-300 ${category === cat ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-500 hover:bg-white/5 hover:text-white"} `}
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
    </div>
  );
}
