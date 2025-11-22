"use client";

import { useState } from "react";

type Category = "beginners" | "advanced";

interface Match {
    id: string;
    team1: string;
    team2: string;
    winner?: string;
}

interface Round {
    name: string;
    matches: Match[];
}

interface BracketData {
    leftSide: Round[];
    rightSide: Round[];
    final: Match;
}

const BEGINNERS_DATA: BracketData = {
    leftSide: [
        {
            name: "Quarterfinals",
            matches: [
                { id: "bq1", team1: "? (Null)", team2: "Alfa team", winner: "Alfa team" },
                { id: "bq2", team1: "Búhos Team", team2: "CR Dragonfly", winner: "CR Dragonfly" },
            ]
        },
        {
            name: "Semifinals",
            matches: [
                { id: "bs1", team1: "Alfa team", team2: "CR Dragonfly", winner: "CR Dragonfly" },
            ]
        }
    ],
    rightSide: [
        {
            name: "Quarterfinals",
            matches: [
                { id: "bq3", team1: "ForEagles", team2: "Lighting Blue", winner: "Lighting Blue" },
                { id: "bq4", team1: "Los Papeatronix", team2: "PrepaTec ValleAlto", winner: "PrepaTec ValleAlto" },
            ]
        },
        {
            name: "Semifinals",
            matches: [
                { id: "bs2", team1: "Lighting Blue", team2: "PrepaTec ValleAlto", winner: "PrepaTec ValleAlto" },
            ]
        }
    ],
    final: { id: "bf", team1: "CR Dragonfly", team2: "PrepaTec ValleAlto" }
};

const ADVANCED_DATA: BracketData = {
    leftSide: [
        {
            name: "Quarterfinals",
            matches: [
                { id: "aq1", team1: "CyberWolves", team2: "RoboTech", winner: "CyberWolves" },
                { id: "aq2", team1: "MechWarriors", team2: "IronGiants", winner: "IronGiants" },
            ]
        },
        {
            name: "Semifinals",
            matches: [
                { id: "as1", team1: "CyberWolves", team2: "IronGiants", winner: "CyberWolves" },
            ]
        }
    ],
    rightSide: [
        {
            name: "Quarterfinals",
            matches: [
                { id: "aq3", team1: "TechTitans", team2: "CircuitBreakers", winner: "TechTitans" },
                { id: "aq4", team1: "NanoBots", team2: "QuantumForce", winner: "QuantumForce" },
            ]
        },
        {
            name: "Semifinals",
            matches: [
                { id: "as2", team1: "TechTitans", team2: "QuantumForce", winner: "TechTitans" },
            ]
        }
    ],
    final: { id: "af", team1: "CyberWolves", team2: "TechTitans" }
};

function TeamNode({ name, isWinner, align = "left" }: { name: string; isWinner?: boolean; align?: "left" | "right" }) {
    return (
        <div
            className={`
                relative group flex items-center
                ${align === "right" ? "flex-row-reverse" : "flex-row"}
            `}
        >
            {/* Connector Dot */}
            <div className={`
                w-3 h-3 rounded-full border-2 z-10
                ${isWinner
                    ? "bg-blue-500 border-white shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                    : "bg-slate-900 border-slate-600 group-hover:border-blue-400 transition-colors"}
                ${align === "right" ? "-ml-1.5" : "-mr-1.5"}
            `}></div>

            {/* Team Card */}
            <div
                className={`
                    relative overflow-hidden px-6 py-3 rounded-lg border backdrop-blur-md transition-all duration-300
                    min-w-[160px] md:min-w-[200px]
                    ${isWinner
                        ? "bg-blue-950/60 border-blue-400/50 shadow-[0_0_20px_rgba(37,99,235,0.3)] scale-105 z-10"
                        : "bg-slate-900/40 border-slate-700/50 hover:bg-slate-800/60 hover:border-blue-500/30 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]"}
                    ${align === "right" ? "text-right mr-4" : "text-left ml-4"}
                `}
            >
                {/* Glow Effect on Winner */}
                {isWinner && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent pointer-events-none"></div>
                )}

                <span className={`
                    font-bold text-sm md:text-base
                    ${isWinner ? "text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" : "text-slate-300 group-hover:text-white"}
                `}>
                    {name}
                </span>
            </div>
        </div>
    );
}

function Connector({ type }: { type: "straight" | "elbow-up" | "elbow-down" | "t-shape" }) {
    return <div className="w-8 md:w-12 h-[2px] bg-blue-900/50 shadow-[0_0_5px_rgba(30,58,138,0.5)]"></div>;
}

function MatchColumn({ matches, align }: { matches: Match[]; align: "left" | "right" }) {
    return (
        <div className="flex flex-col justify-around h-full gap-12 py-12">
            {matches.map((match) => (
                <div key={match.id} className={`flex flex-col gap-4 relative ${align === "right" ? "items-end" : "items-start"}`}>
                    <TeamNode name={match.team1} isWinner={match.winner === match.team1} align={align} />

                    {/* Visual Connector Line between teams in a match */}
                    <div className={`
                        absolute top-1/2 w-8 border-t-2 border-b-2 border-r-2 border-slate-700/30 h-full -z-10
                        ${align === "right" ? "right-full border-l-0 rounded-r-none rounded-l-xl mr-[-1rem]" : "left-full border-r-0 rounded-l-none rounded-r-xl ml-[-1rem]"}
                        hidden md:block
                    `}></div>

                    <TeamNode name={match.team2} isWinner={match.winner === match.team2} align={align} />
                </div>
            ))}
        </div>
    );
}

export default function BracketsPage() {
    const [category, setCategory] = useState<Category>("beginners");
    const data = category === "beginners" ? BEGINNERS_DATA : ADVANCED_DATA;

    return (
        <div className="min-h-screen text-white p-4 md:p-8 flex flex-col items-center relative">

            {/* Header & Toggle */}
            <div className="relative z-10 flex flex-col items-center mb-12 gap-8 w-full max-w-4xl">
                <div className="text-center space-y-2">
                    <h2 className="text-gray-400 text-sm uppercase tracking-widest">
                        Tecnológico de Monterrey
                    </h2>
                    <h1 className="text-3xl md:text-5xl font-bold mt-2">
                        RoboChamp <span className="text-blue-500">{category === "beginners" ? "Beginners" : "Advanced"}</span>
                    </h1>
                </div>

                {/* Toggle Switch */}
                <div className="flex bg-blue-950/50 p-1 rounded-full border border-blue-900/50 backdrop-blur-sm">
                    <button
                        onClick={() => setCategory("beginners")}
                        className={`
                            px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300
                            ${category === "beginners" ? "bg-blue-600 text-white shadow-lg" : "text-blue-300 hover:text-white"}
                        `}
                    >
                        Beginners
                    </button>
                    <button
                        onClick={() => setCategory("advanced")}
                        className={`
                            px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300
                            ${category === "advanced" ? "bg-blue-600 text-white shadow-lg" : "text-blue-300 hover:text-white"}
                        `}
                    >
                        Advanced
                    </button>
                </div>
            </div>

            {/* Bracket Visualization */}
            <div key={category} className="relative z-10 w-full max-w-[90rem] flex justify-center items-center gap-8 md:gap-16 overflow-x-auto pb-12 px-4 scrollbar-hide">

                {/* Left Side */}
                <div className="flex gap-8 md:gap-16">
                    {data.leftSide.map((round, i) => (
                        <div key={i} className="flex flex-col items-center">
                            <h3 className="text-blue-400 text-sm font-semibold mb-8">{round.name}</h3>
                            <MatchColumn matches={round.matches} align="left" />
                        </div>
                    ))}
                </div>

                {/* Center Final */}
                <div className="flex flex-col items-center justify-center px-8 md:px-16 relative">
                    <h3 className="text-yellow-400 text-sm font-bold mb-8">Grand Final</h3>

                    <div className="flex flex-col gap-8 items-center scale-110 relative z-10">
                        <TeamNode name={data.final.team1} align="left" />

                        <div className="relative flex items-center justify-center">
                            <div className="h-12 w-[2px] bg-yellow-500/50 absolute -top-12"></div>
                            <div className="h-12 w-[2px] bg-yellow-500/50 absolute -bottom-12"></div>
                            <div className="text-2xl font-bold text-yellow-500 px-4">
                                VS
                            </div>
                        </div>

                        <TeamNode name={data.final.team2} align="right" />
                    </div>
                </div>

                {/* Right Side */}
                <div className="flex gap-8 md:gap-16 flex-row-reverse">
                    {data.rightSide.map((round, i) => (
                        <div key={i} className="flex flex-col items-center">
                            <h3 className="text-blue-400 text-sm font-semibold mb-8">{round.name}</h3>
                            <MatchColumn matches={round.matches} align="right" />
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
