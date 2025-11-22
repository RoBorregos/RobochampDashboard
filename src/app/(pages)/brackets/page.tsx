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
                px-4 py-2 rounded-full border border-blue-900 bg-blue-950/80 text-white font-medium text-sm md:text-base min-w-[140px] md:min-w-[160px] transition-all duration-300
                ${isWinner ? "bg-blue-800 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] scale-105" : "opacity-80"}
                ${align === "right" ? "text-right" : "text-left"}
            `}
        >
            {name}
        </div>
    );
}

function Connector({ type }: { type: "straight" | "elbow-up" | "elbow-down" | "t-shape" }) {
    // Simplified connectors using CSS borders
    if (type === "straight") return <div className="w-8 h-[2px] bg-blue-500/50"></div>;
    return <div className="w-8 h-[2px] bg-blue-500/50"></div>; // Placeholder for complex connectors
}

function MatchColumn({ matches, align }: { matches: Match[]; align: "left" | "right" }) {
    return (
        <div className="flex flex-col justify-around h-full gap-8 py-8">
            {matches.map((match) => (
                <div key={match.id} className={`flex flex-col gap-2 ${align === "right" ? "items-end" : "items-start"}`}>
                    <TeamNode name={match.team1} isWinner={match.winner === match.team1} align={align} />
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
        <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center">
            {/* Header & Toggle */}
            <div className="flex flex-col items-center mb-12 gap-6">
                <div className="flex items-center gap-4">
                    {/* Logo placeholder if needed */}
                    <div className="text-center">
                        <h2 className="text-gray-400 text-sm uppercase tracking-widest">Tecnológico de Monterrey</h2>
                        <h1 className="text-3xl md:text-5xl font-bold mt-2">
                            RoboChamp <span className="text-blue-500">{category === "beginners" ? "Beginners" : "Advanced"}</span>
                        </h1>
                    </div>
                </div>

                <div className="flex bg-blue-950/50 p-1 rounded-full border border-blue-900/50">
                    <button
                        onClick={() => setCategory("beginners")}
                        className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${category === "beginners" ? "bg-blue-600 text-white shadow-lg" : "text-blue-300 hover:text-white"
                            }`}
                    >
                        Beginners
                    </button>
                    <button
                        onClick={() => setCategory("advanced")}
                        className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${category === "advanced" ? "bg-blue-600 text-white shadow-lg" : "text-blue-300 hover:text-white"
                            }`}
                    >
                        Advanced
                    </button>
                </div>
            </div>

            {/* Bracket Visualization */}
            <div key={category} className="w-full max-w-7xl flex justify-center items-center gap-4 md:gap-8 overflow-x-auto pb-8">

                {/* Left Side */}
                <div className="flex gap-4 md:gap-8">
                    {data.leftSide.map((round, i) => (
                        <div key={i} className="flex flex-col items-center">
                            <h3 className="text-blue-400 text-xs uppercase mb-4 tracking-wider">{round.name}</h3>
                            <MatchColumn matches={round.matches} align="left" />
                        </div>
                    ))}
                </div>

                {/* Center Final */}
                <div className="flex flex-col items-center justify-center px-4 md:px-12">
                    <h3 className="text-yellow-400 text-xs uppercase mb-4 tracking-wider font-bold">Grand Final</h3>
                    <div className="flex flex-col gap-4 items-center scale-110">
                        <TeamNode name={data.final.team1} align="left" />
                        <div className="h-8 w-[2px] bg-yellow-500/50"></div>
                        <div className="text-2xl font-bold text-yellow-500">VS</div>
                        <div className="h-8 w-[2px] bg-yellow-500/50"></div>
                        <TeamNode name={data.final.team2} align="right" />
                    </div>
                </div>

                {/* Right Side */}
                <div className="flex gap-4 md:gap-8 flex-row-reverse">
                    {data.rightSide.map((round, i) => (
                        <div key={i} className="flex flex-col items-center">
                            <h3 className="text-blue-400 text-xs uppercase mb-4 tracking-wider">{round.name}</h3>
                            <MatchColumn matches={round.matches} align="right" />
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
