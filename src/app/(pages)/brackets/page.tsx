"use client";

import { useState } from "react";

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
    rounds: Round[]; // Preliminary + Qualifiers + Group Final
    finalMatch: Match; // Last match deciding the group semifinalist
    seeds?: string[]; // Ordered list of initial teams for vertical display
}

interface BeginnersBracketData {
    groups: Group[];
    semifinalists: string[]; // Exactly 3 (one per group)
    final: Match; // Final between 2 of the semifinalists
    thirdPlaceTeam: string; // Automatic third place (the semifinalist not in final)
}

// --- Data Constants ---

const BEGINNERS_DATA: BeginnersBracketData = {
    groups: [
        {
            id: "ga",
            name: "Grupo A",
            seeds: ["Team A1", "Team A5", "Team A2", "Team A3", "Team A4"],
            rounds: [
                { name: "Prelim", matches: [ { id: "ga_pre", team1: "Team A1", team2: "Team A5", winner: "Team A1" } ] },
                { name: "Qualifiers", matches: [
                    { id: "ga_q1", team1: "Team A1", team2: "Team A2", winner: "Team A1" },
                    { id: "ga_q2", team1: "Team A3", team2: "Team A4", winner: "Team A3" }
                ]},
                { name: "Group Final", matches: [ { id: "ga_final", team1: "Team A1", team2: "Team A3", winner: "Team A1" } ] }
            ],
            finalMatch: { id: "ga_final", team1: "Team A1", team2: "Team A3", winner: "Team A1" }
        },
        {
            id: "gb",
            name: "Grupo B",
            seeds: ["Team B1", "Team B4", "Team B2", "Team B3"],
            rounds: [
                { name: "Qualifiers", matches: [
                    { id: "gb_q1", team1: "Team B1", team2: "Team B4", winner: "Team B1" },
                    { id: "gb_q2", team1: "Team B2", team2: "Team B3", winner: "Team B2" }
                ]},
                { name: "Group Final", matches: [ { id: "gb_final", team1: "Team B1", team2: "Team B2", winner: "Team B1" } ] }
            ],
            finalMatch: { id: "gb_final", team1: "Team B1", team2: "Team B2", winner: "Team B1" }
        },
        {
            id: "gc",
            name: "Grupo C",
            seeds: ["Team C1", "Team C4", "Team C2", "Team C3"],
            rounds: [
                { name: "Qualifiers", matches: [
                    { id: "gc_q1", team1: "Team C1", team2: "Team C4", winner: "Team C1" },
                    { id: "gc_q2", team1: "Team C2", team2: "Team C3", winner: "Team C2" }
                ]},
                { name: "Group Final", matches: [ { id: "gc_final", team1: "Team C1", team2: "Team C2", winner: "Team C1" } ] }
            ],
            finalMatch: { id: "gc_final", team1: "Team C1", team2: "Team C2", winner: "Team C1" }
        }
    ],
    semifinalists: ["Team A1", "Team B1", "Team C1"],
    final: { id: "beg_final", team1: "Team A1", team2: "Team B1", winner: "Team A1" },
    thirdPlaceTeam: "Team C1"
};

const ADVANCED_DATA: AdvancedBracketData = {
    rounds: [
        {
            name: "Quarterfinals",
            matches: [
                { id: "aq1", team1: "CyberWolves", team2: "RoboTech", team3: "NanoBots", winner: "CyberWolves" },
                { id: "aq2", team1: "MechWarriors", team2: "IronGiants", team3: "QuantumForce", winner: "MechWarriors" },
                { id: "aq3", team1: "TechTitans", team2: "CircuitBreakers", team3: "NanoBots", winner: "TechTitans" },

            ]
        },
        {
            name: "Semifinals",
            matches: [
                { id: "as1", team1: "CyberWolves", winner: "CyberWolves" },
                { id: "as2", team1: "TechTitans", winner: "TechTitans" },
                { id: "as3", team1: "MechWarriors", winner: "MechWarriors" }
            ]
        }
    ],
    final: { id: "af", team1: "MechWarriors", team2: "TechTitans", winner: "TechTitans" },
    thirdPlace: { id: "atp", team1: "CyberWolves", winner: "CyberWolves" }
};

// --- Components ---

function TeamPill({ name, isWinner, small = false }: { name: string; isWinner?: boolean; small?: boolean }) {
    return (
        <div className={`
            relative flex items-center justify-center
            ${small ? "w-32 h-10 text-xs" : "w-48 h-14 md:w-56 md:h-16"}
            rounded-2xl border transition-all duration-300
            ${isWinner
                ? "bg-blue-600 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] text-white font-bold z-10 scale-105"
                : "bg-[#1a1a1a] border-[#333] text-slate-400 hover:border-slate-600"}
        `}>
            <span className="truncate px-4">{name}</span>
        </div>
    );
}

function MatchNode({ match, roundIndex }: { match: Match; roundIndex: number }) {
    return (
        <div className="flex flex-col gap-3 md:gap-4 relative">
            {match.team1 && (
                <TeamPill name={match.team1} isWinner={match.winner === match.team1} />
            )}
            {match.team2 && (
                <div className="absolute right-[-1rem] top-1/2 -translate-y-1/2 w-[1px] h-[calc(100%-3.5rem)] bg-slate-700 hidden md:block translate-x-full"></div>
            )}
            <div className="absolute right-[-2rem] top-1/2 w-4 h-[1px] bg-slate-700 translate-x-full hidden md:block"></div>
            {match.team2 && (
                <TeamPill name={match.team2} isWinner={match.winner === match.team2} />
            )}
            {match.team3 && (
                <TeamPill name={match.team3} isWinner={match.winner === match.team3} />
            )}
        </div>
    );
}

// --- Beginners Components ---

function GroupBracket({ group }: { group: Group }) {
    const qualifiers = group.rounds.find(r => r.name === "Qualifiers");
    const groupFinal = group.finalMatch;

    return (
        <div className="relative flex items-center gap-12">
            
            {/* Seeds vertical */}
            <div className="flex flex-col gap-3 md:gap-4">
                {group.seeds?.map(seed => (
                    <TeamPill key={seed} name={seed} />
                ))}
            </div>
            
            {/* Two qualifiers vertical */}
            <div className="flex flex-col gap-8 relative">
                {qualifiers?.matches?.slice(0, 2)?.map((m, idx) => (
                    <div key={m.id} className="relative">
                        <TeamPill name={m.winner ?? 'TBD'} />
                        <div className="absolute left-full top-1/2 w-8 h-[1px] bg-slate-700 hidden md:block"></div>
                        {idx === 0 && (
                            <div className="absolute left-[calc(100%+2rem)] top-1/2 w-[1px] h-[6rem] bg-slate-700 hidden md:block"></div>
                        )}
                    </div>
                ))}
            </div>
            
            {/* Group winner */}
            <div className="relative">
                <TeamPill name={groupFinal.winner ?? 'TBD'} isWinner />
                
            </div>
        </div>
    );
}

// --- Beginners Layout ---

function BeginnersLayout({ data }: { data: BeginnersBracketData }) {
    const runnerUp = data.final.winner === data.final.team1 ? data.final.team2 : data.final.team1;

    return (
        <div className="flex flex-col items-center w-full gap-20 pb-12 px-4">
            <div className="w-full max-w-7xl flex flex-col md:flex-row md:items-start md:justify-center gap-20">
                {/* Left: Groups stacked vertically */}
                <div className="flex flex-col gap-14">
                    {data.groups.map(g => (
                        <GroupBracket key={g.id} group={g} />
                    ))}
                </div>
                

                
                {/* Right: Final and Winners */}
                <div className="relative flex flex-col items-center gap-12 pt-4">
                    {/* Final card with winner to the right */}
                    <div className="relative flex items-center gap-8">
                        <div className="flex flex-col items-center gap-2">
                            <h3 className="text-xs uppercase tracking-widest font-bold text-blue-400">Final</h3>
                            <div className="flex flex-col items-center gap-1">
                                <TeamPill name={data.final.team1 ?? 'TBD'} isWinner={data.final.winner === data.final.team1} />
                                <span className="text-[10px] text-slate-500 font-bold">VS</span>
                                <TeamPill name={data.final.team2 ?? 'TBD'} isWinner={data.final.winner === data.final.team2} />
                            </div>
                        </div>
                        {/* Winner to the right */}
                        {data.final.winner && (
                            <div className="relative flex items-center gap-4">
                                <div className="absolute right-full top-1/2 -translate-y-1/2 w-8 h-[1px] bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                                <div className="flex flex-col items-center gap-2">
                                    <span className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Campeón</span>
                                    <TeamPill name={data.final.winner} isWinner />
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Third place directly below */}
                    <div className="flex flex-col items-center gap-2">
                        <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-500">3er Lugar</h3>
                        <TeamPill name={data.thirdPlaceTeam ?? 'TBD'} />
                    </div>
                </div>
            </div>
        </div>
    );
}
function AdvancedLayout({ data }: { data: AdvancedBracketData }) {
const quarterfinals = data.rounds[0];
const semifinals = data.rounds[1];

if (!quarterfinals || !semifinals) return null;

return (
<div className="flex flex-col items-center w-full gap-20 pb-12 px-4">
<div className="w-full max-w-7xl flex flex-col md:flex-row md:items-start md:justify-center gap-20">
{/* Grid of Quarter -> Semifinal rows */}
<div className="flex flex-col gap-14">
{quarterfinals.matches.slice(0,3).map((qMatch, idx) => {
const semiMatch = semifinals.matches[idx];
const semiWinner = semiMatch?.winner ?? semiMatch?.team1 ?? undefined;
return (
<div key={qMatch.id} className="relative flex items-center gap-16">
{/* Quarter block */}
<div className="relative">
<MatchNode match={qMatch} roundIndex={0} />
<div className="absolute right-[-2rem] top-1/2 w-12 h-[1px] bg-slate-700 hidden md:block"></div>
</div>
{/* Semifinal single team */}
<div className="relative">
<TeamPill name={semiWinner ?? 'TBD'} />
{/* Connector forward if advances */}
<div className="absolute right-[-2rem] top-1/2 h-[1px] hidden md:block"></div>
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
<h3 className="text-xs uppercase tracking-widest font-bold text-blue-400">Final</h3>
<div className="flex flex-col items-center gap-1">
<TeamPill name={data.final.team1 ?? 'TBD'} isWinner={data.final.winner === data.final.team1} />
<span className="text-[10px] text-slate-500 font-bold">VS</span>
<TeamPill name={data.final.team2 ?? 'TBD'} isWinner={data.final.winner === data.final.team2} />
</div>
</div>
{/* Winner to the right */}
{data.final.winner && (
<div className="relative flex items-center gap-4">
<div className="absolute right-full top-1/2 -translate-y-1/2 w-8 h-[1px] bg-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
<div className="flex flex-col items-center gap-2">
<span className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Campeón</span>
<TeamPill name={data.final.winner} isWinner />
</div>
</div>
)}
</div>
{/* Third place directly below - no box */}
{data.thirdPlace && (
<div className="flex flex-col items-center gap-2">
<h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-500">3er Lugar</h3>
<TeamPill name={data.thirdPlace.winner ?? data.thirdPlace.team1 ?? 'TBD'} isWinner={!!data.thirdPlace.winner} />
</div>
)}
</div>
</div>
</div>
);
}


export default function BracketsPage() {
const [category, setCategory] = useState("beginners");


return (
<div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 pt-24 md:pt-32 flex flex-col items-center overflow-auto">
{/* Header */}
<div className="flex flex-col items-center mb-16 gap-8 z-10 w-full max-w-4xl">
<h1 className="text-4xl md:text-6xl font-black text-center tracking-tight">
ROBO<span className="text-blue-600">CHAMP</span>
<span className="block text-xl md:text-2xl font-medium text-slate-500 mt-2 uppercase tracking-widest">{category}</span>
</h1>


{/* Toggle */}
<div className="flex bg-[#1a1a1a] p-1.5 rounded-full border border-white/10">
{(["beginners", "advanced"] as Category[]).map((cat) => (
<button
key={cat}
onClick={() => setCategory(cat)}
className={`
px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 uppercase tracking-wider
${category === cat ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-500 hover:text-white hover:bg-white/5"}
`}
>
{cat}
</button>
))}
</div>
</div>
            {/* Main Content Area */}
            {category === "beginners" ? (
                <BeginnersLayout data={BEGINNERS_DATA} />
            ) : (
                <AdvancedLayout data={ADVANCED_DATA} />
            )}
        </div>
    );
}
