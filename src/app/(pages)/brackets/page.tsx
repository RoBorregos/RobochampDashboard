"use client";

import { useState } from "react";

type Category = "beginners" | "advanced";

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

// --- Advanced Bracket Interfaces (Standard Tree) ---
interface AdvancedBracketData {
    rounds: Round[];
    final: Match;
    thirdPlace?: Match;
}

// --- Beginners Bracket Interfaces (3 Groups) ---
interface Group {
    id: string;
    name: string;
    rounds: Round[]; // Full bracket history for the group
    finalMatch: Match; // The match between the top 2 of this group (helper)
    colorClass: string; // Color theme for this group
}

interface BeginnersBracketData {
    groups: Group[];
    grandFinal: Match;
    thirdPlaceTeam: string; // Static assignment for the 3rd group winner
}

// --- Data Constants ---

const BEGINNERS_DATA: BeginnersBracketData = {
    groups: [
        {
            id: "g1",
            name: "Grupo 1",
            colorClass: "bg-purple-600",
            rounds: [
                {
                    name: "Eliminatoria",
                    matches: [
                        { id: "g1_r1_m1", team1: "Team A5", team2: "Team A4", winner: "Team A4" },
                        // Byes are implicit or visual only in this simple structure, 
                        // but for 5 teams we need 1 match to reduce 5->4, then 4->2, then 2->1
                    ]
                },
                {
                    name: "Semifinales",
                    matches: [
                        { id: "g1_r2_m1", team1: "Team A1", team2: "Team A4", winner: "Team A1" },
                        { id: "g1_r2_m2", team1: "Team A2", team2: "Team A3", winner: "Team A2" }
                    ]
                },
                {
                    name: "Final Grupo",
                    matches: [
                        { id: "g1_final", team1: "Team A1", team2: "Team A2", winner: "Team A1" }
                    ]
                }
            ],
            finalMatch: { id: "g1_final", team1: "Team A1", team2: "Team A2", winner: "Team A1" }
        },
        {
            id: "g2",
            name: "Grupo 2",
            colorClass: "bg-pink-500",
            rounds: [
                {
                    name: "Semifinales",
                    matches: [
                        { id: "g2_r1_m1", team1: "Team B1", team2: "Team B4", winner: "Team B1" },
                        { id: "g2_r1_m2", team1: "Team B2", team2: "Team B3", winner: "Team B2" }
                    ]
                },
                {
                    name: "Final Grupo",
                    matches: [
                        { id: "g2_final", team1: "Team B1", team2: "Team B2", winner: "Team B1" }
                    ]
                }
            ],
            finalMatch: { id: "g2_final", team1: "Team B1", team2: "Team B2", winner: "Team B1" }
        },
        {
            id: "g3",
            name: "Grupo 3",
            colorClass: "bg-cyan-500",
            rounds: [
                {
                    name: "Semifinales",
                    matches: [
                        { id: "g3_r1_m1", team1: "Team C1", team2: "Team C4", winner: "Team C1" },
                        { id: "g3_r1_m2", team1: "Team C2", team2: "Team C3", winner: "Team C2" }
                    ]
                },
                {
                    name: "Final Grupo",
                    matches: [
                        { id: "g3_final", team1: "Team C1", team2: "Team C2", winner: "Team C1" }
                    ]
                }
            ],
            finalMatch: { id: "g3_final", team1: "Team C1", team2: "Team C2", winner: "Team C1" }
        }
    ],
    // Logic: Winner of G1 vs Winner of G2 in Final. Winner of G3 takes 3rd place.
    grandFinal: { id: "bgf", team1: "Team A1", team2: "Team B1", winner: "Team A1" },
    thirdPlaceTeam: "Team C1"
};

const ADVANCED_DATA: AdvancedBracketData = {
    rounds: [
        {
            name: "Quarterfinals",
            matches: [
                { id: "aq1", team1: "CyberWolves", team2: "RoboTech", team3: "NanoBots", winner: "CyberWolves" },
                { id: "aq2", team1: "MechWarriors", team2: "IronGiants", team3: "QuantumForce", winner: "IronGiants" },
                { id: "aq3", team1: "TechTitans", team2: "CircuitBreakers", team3: "NanoBots", winner: "TechTitans" },

            ]
        },
        {
            name: "Semifinals",
            matches: [
                { id: "as1", team1: "CyberWolves", winner: "CyberWolves" },
                { id: "as2", team1: "TechTitans", winner: "TechTitans" },
                { id: "as3", team1: "MechWarriors", winner: "MechWarriors" },
            ]
        }
    ],
    final: { id: "af", team1: "CyberWolves", team2: "TechTitans", winner: "TechTitans" }
};

// --- Components ---

function TeamPill({ name, isWinner, colorClass, small = false }: { name: string; isWinner?: boolean; colorClass: string; small?: boolean }) {
    return (
        <div className={`
            relative flex items-center justify-center
            ${small ? "w-28 h-8 text-xs" : "w-40 md:w-48 h-10 md:h-12"}
            rounded-full border-2 transition-all duration-300
            ${isWinner
                ? `${colorClass} border-white/50 shadow-lg scale-105 z-10 text-white font-bold`
                : "bg-white/10 border-white/20 text-slate-300 hover:bg-white/20"}
        `}>
            <span className="truncate px-4">{name}</span>
            {/* Connector Line Stub (Right side) - Only for standard tree view usually */}
            {!small && <div className="absolute right-0 top-1/2 w-4 h-[2px] bg-slate-500/50 translate-x-full hidden md:block"></div>}
        </div>
    );
}

function MatchNode({ match, roundIndex, colorClassOverride }: { match: Match; roundIndex: number; colorClassOverride?: string }) {
    const colors = ["bg-purple-600", "bg-pink-500", "bg-cyan-500", "bg-blue-600"];
    const colorClass = colorClassOverride ?? (colors[roundIndex % colors.length] ?? "bg-purple-600");

    return (
        <div className="flex flex-col gap-2 md:gap-4 relative">
            {match.team1 && (
                <TeamPill name={match.team1} isWinner={match.winner === match.team1} colorClass={colorClass} />
            )}
            <div className="absolute right-[-1rem] top-1/2 -translate-y-1/2 w-[2px] h-[calc(100%-2.5rem)] bg-slate-500/50 hidden md:block translate-x-full"></div>
            <div className="absolute right-[-2rem] top-1/2 w-4 h-[2px] bg-slate-500/50 translate-x-full hidden md:block"></div>
            {match.team2 && (
                <TeamPill name={match.team2} isWinner={match.winner === match.team2} colorClass={colorClass} />
            )}
            {match.team3 && (
                <TeamPill name={match.team3} isWinner={match.winner === match.team3} colorClass={colorClass} />
            )}
        </div>
    );
}

function Podium({ winner, runnerUp, thirdPlace }: { winner?: string; runnerUp?: string; thirdPlace?: string }) {
    return (
        <div className="flex flex-col items-center gap-8 mt-8 md:mt-0 md:ml-16">
            <div className="flex items-end gap-4">
                {/* 2nd Place */}
                <div className="flex flex-col items-center gap-2">
                    <span className="text-slate-400 text-sm font-bold">2do Lugar</span>
                    <div className="w-32 h-12 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold shadow-lg">
                        {runnerUp || "TBD"}
                    </div>
                    <div className="w-2 h-16 bg-slate-600/50"></div>
                </div>

                {/* 1st Place */}
                <div className="flex flex-col items-center gap-2 mb-12">
                    <span className="text-yellow-400 text-sm font-bold">1er Lugar</span>
                    <div className="w-40 h-16 rounded-full bg-yellow-400 flex items-center justify-center text-black font-bold shadow-[0_0_20px_rgba(250,204,21,0.5)] scale-110 z-10">
                        {winner || "TBD"}
                    </div>
                    <div className="w-2 h-24 bg-yellow-400/50"></div>
                </div>

                {/* 3rd Place */}
                <div className="flex flex-col items-center gap-2">
                    <span className="text-slate-400 text-sm font-bold">3er Lugar</span>
                    <div className="w-32 h-12 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold shadow-lg">
                        {thirdPlace || "TBD"}
                    </div>
                    <div className="w-2 h-8 bg-slate-600/50"></div>
                </div>
            </div>
        </div>
    );
}

// --- Beginners Specific Components ---

function GroupBracket({ group }: { group: Group }) {
    return (
        <div className="flex items-center gap-8">
            {/* Render rounds for this group */}
            {group.rounds.map((round, rIdx) => (
                <div key={rIdx} className="flex flex-col justify-around gap-8">
                    {round.matches.map((match) => (
                        <div key={match.id} className="flex flex-col gap-2 relative">
                            {/* Custom Mini Match Node */}
                            <TeamPill
                                name={match.team1 || "TBD"}
                                isWinner={match.winner === match.team1}
                                colorClass={group.colorClass}
                                small
                            />
                            {/* Connectors */}
                            <div className="absolute right-[-0.5rem] top-1/2 -translate-y-1/2 w-[1px] h-[calc(100%-1rem)] bg-slate-500/50 hidden md:block translate-x-full"></div>
                            <div className="absolute right-[-1rem] top-1/2 w-2 h-[1px] bg-slate-500/50 translate-x-full hidden md:block"></div>

                            <TeamPill
                                name={match.team2 || "TBD"}
                                isWinner={match.winner === match.team2}
                                colorClass={group.colorClass}
                                small
                            />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

function BeginnersLayout({ data }: { data: BeginnersBracketData }) {
    return (
        <div className="flex flex-col md:flex-row items-center justify-center w-full gap-12 md:gap-24">
            {/* Left Side: 3 Group Brackets Stacked Vertically */}
            <div className="flex flex-col gap-16">
                {data.groups.map((group) => (
                    <div key={group.id} className="flex flex-col gap-2">
                        {/* <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{group.name}</h3> */}
                        <GroupBracket group={group} />
                    </div>
                ))}
            </div>

            {/* Connector Line Logic (Visual approximation) */}
            {/* We need a big bracket connecting the top 2 groups to the final */}

            {/* Right Side: Grand Final & Podium */}
            <div className="flex flex-col items-center gap-12">
                <div className="flex flex-col items-center gap-4">
                    <h2 className="text-2xl font-bold text-yellow-400 uppercase tracking-widest">Gran Final</h2>
                    <div className="flex flex-col gap-2 relative p-8 bg-white/5 rounded-2xl border border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.1)]">
                        <TeamPill
                            name={data.grandFinal.team1 || "TBD"}
                            isWinner={data.grandFinal.winner === data.grandFinal.team1}
                            colorClass="bg-yellow-500"
                        />
                        <div className="my-2 text-center text-sm font-bold text-slate-500">VS</div>
                        <TeamPill
                            name={data.grandFinal.team2 || "TBD"}
                            isWinner={data.grandFinal.winner === data.grandFinal.team2}
                            colorClass="bg-yellow-500"
                        />
                    </div>
                </div>

                <Podium
                    winner={data.grandFinal.winner}
                    runnerUp={data.grandFinal.team1 === data.grandFinal.winner ? data.grandFinal.team2 : data.grandFinal.team1}
                    thirdPlace={data.thirdPlaceTeam}
                />
            </div>
        </div>
    );
}

function AdvancedLayout({ data }: { data: AdvancedBracketData }) {
    const quarterfinals = data.rounds[0];
    const semifinals = data.rounds[1];

    if (!quarterfinals || !semifinals) return null;

    return (
        <div className="flex flex-col md:flex-row items-center justify-center w-full gap-12 md:gap-24 overflow-x-auto pb-12 px-4">
            {/* Column 1: Quarterfinals */}
            <div className="flex flex-col gap-8 justify-center">
                {quarterfinals.matches.map((match) => (
                    <div key={match.id} className="relative">
                        <MatchNode match={match} roundIndex={0} />
                        {/* Connector to next round */}
                        <div className="absolute right-[-2rem] top-1/2 w-8 h-[2px] bg-slate-500/50 hidden md:block translate-x-full"></div>
                    </div>
                ))}
            </div>

            {/* Column 2: Semifinals */}
            <div className="flex flex-col gap-24 justify-center relative">
                {/* Top 2 Semifinalists (Advance to Final) */}
                <div className="flex flex-col gap-32">
                    {semifinals.matches.slice(0, 2).map((match, idx) => (
                        <div key={match.id} className="relative">
                            <MatchNode match={match} roundIndex={1} />
                            {/* Connector to Final */}
                            <div className="absolute right-[-2rem] top-1/2 w-8 h-[2px] bg-slate-500/50 hidden md:block translate-x-full"></div>
                            {/* Vertical Connector Part */}
                            <div className={`absolute right-[-4rem] w-[2px] bg-slate-500/50 hidden md:block translate-x-full ${idx === 0 ? "top-1/2 h-[calc(50%+4rem)]" : "bottom-1/2 h-[calc(50%+4rem)] top-auto"
                                }`}></div>
                        </div>
                    ))}
                </div>

                {/* 3rd Semifinalist (3rd Place) - Visually separated */}
                {semifinals.matches[2] && (
                    <div className="relative mt-8">
                        <div className="absolute left-[-2rem] top-1/2 w-8 h-[2px] bg-slate-500/50 hidden md:block -translate-x-full"></div>
                        <MatchNode match={semifinals.matches[2]} roundIndex={1} colorClassOverride="bg-slate-600" />
                        <div className="absolute -bottom-8 left-0 w-full text-center text-slate-400 text-sm font-bold">3er Lugar</div>
                    </div>
                )}
            </div>

            {/* Column 3: Final & Winner */}
            <div className="flex flex-col gap-16 justify-center items-center relative -mt-32">
                {/* Final Match Node */}
                <div className="flex items-center gap-8">
                    <div className="flex flex-col gap-2 relative">
                        {/* Connector from vertical line */}
                        <div className="absolute left-[-2rem] top-1/2 w-8 h-[2px] bg-slate-500/50 hidden md:block -translate-x-full"></div>

                        <TeamPill
                            name={data.final.team1 || "TBD"}
                            isWinner={data.final.winner === data.final.team1}
                            colorClass="bg-indigo-500"
                        />
                        <div className="my-1 text-center text-xs text-slate-500">VS</div>
                        <TeamPill
                            name={data.final.team2 || "TBD"}
                            isWinner={data.final.winner === data.final.team2}
                            colorClass="bg-indigo-500"
                        />
                    </div>

                    {/* Winner Node */}
                    <div className="relative">
                        <div className="absolute left-[-2rem] top-1/2 w-8 h-[2px] bg-slate-500/50 hidden md:block -translate-x-full"></div>



                        export default function BracketsPage() {
    const [category, setCategory] = useState("beginners");

                        return (
                        <div className="min-h-screen text-white p-4 md:p-8 flex flex-col items-center overflow-hidden">

                            {/* Header */}
                            <div className="flex flex-col items-center mb-12 gap-6 z-10">
                                <h1 className="text-3xl md:text-5xl font-bold text-center">
                                    RoboChamp <span className="text-blue-500 capitalize">{category}</span>
                                </h1>

                                {/* Toggle */}
                                <div className="flex bg-slate-800/50 p-1 rounded-full border border-slate-700 backdrop-blur-sm">
                                    {(["beginners", "advanced"] as Category[]).map((cat) => (
                                        <button
                                            key={cat}
                                            onClick={() => setCategory(cat)}
                                            className={`
                                px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 capitalize
                                ${category === cat ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}
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
