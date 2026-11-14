"use client";
import React, { useState } from "react";
import eventsData from "./events.json";
import TimelineImg from "./timelineImg";

const FILTERS = [
  { label: "Main (All)", value: "All" },
  { label: "Beginners", value: "Beginners" },
  { label: "Advanced", value: "Advanced" },
] as const;

const Timeline: React.FC = () => {
  const [filter, setFilter] = useState<string>("All");
  const rows = eventsData.agenda.filter(
    (r) => filter === "All" || r.category === "Both" || r.category === filter,
  );
  return (
    <div className="relative mt-[10rem] flex w-full justify-center">
      <div className="absolute inset-0 grid grid-cols-2 gap-8 px-10 opacity-15">
        <TimelineImg numberImage={1} col={1} row={1} />
        <TimelineImg numberImage={2} col={2} row={1} />
        <TimelineImg numberImage={3} col={1} row={2} />
        <TimelineImg numberImage={4} col={2} row={2} />
      </div>

      <div className="relative w-full max-w-[48rem] p-4 text-white">
        <h2 className="mt-[5rem] break-words text-center text-[2.5rem] font-bold sm:text-[4rem] text-roboblue">
          Event Schedule
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full border border-roboblue px-4 py-2 text-sm font-semibold transition ${
                filter === f.value
                  ? "bg-roboblue text-black"
                  : "text-roboblue hover:bg-roboblue/20"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mt-6 overflow-x-auto rounded-xl bg-gradient-to-tr from-neutral-950 to-neutral-800">
          <table className="w-full table-auto text-left text-xs sm:text-sm">
            <thead className="text-roboblue">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Activity</th>
                <th className="p-3">Category</th>
                <th className="p-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-neutral-700">
                  <td className="whitespace-nowrap p-3">{row.time}</td>
                  <td className="p-3 font-semibold">{row.activity}</td>
                  <td className="p-3">{row.category}</td>
                  <td className="whitespace-nowrap p-3">{row.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
