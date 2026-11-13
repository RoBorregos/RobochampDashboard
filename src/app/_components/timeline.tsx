import React from "react";
import eventsData from "./events.json";
import TimelineImg from "./timelineImg";

const Timeline: React.FC = () => {
  return (
    <div className="relative mt-[10rem] flex w-full justify-center">
      <div className="absolute inset-0 grid grid-cols-2 gap-8 px-10 opacity-15">
        <TimelineImg numberImage={1} col={1} row={1} />
        <TimelineImg numberImage={2} col={2} row={1} />
        <TimelineImg numberImage={3} col={1} row={2} />
        <TimelineImg numberImage={4} col={2} row={2} />
      </div>

      <div className="relative max-w-[48rem] p-4 text-white">
        <h2 className="mt-[5rem] text-center text-[4rem] font-bold text-roboblue">
          Event Schedule
        </h2>
        <div className="mt-[3rem] overflow-x-auto rounded-xl bg-gradient-to-tr from-neutral-950 to-neutral-800">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-roboblue">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Activity</th>
                <th className="p-3">Category</th>
                <th className="p-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {eventsData.agenda.map((row, index) => (
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
