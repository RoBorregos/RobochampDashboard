"use client";
import { useState } from "react";
import { TeamType } from "rbrgs/server/api/routers/team";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../shadcn/ui/select";
import { patternData } from "../pattern";
import Image from "next/image";

const Results = ({ team }: { team: TeamType }) => {
  const challengeA = team?.challengeA;
  const challengeB = team?.challengeB;
  const challengeC = team?.challengeC;
  const [selected, setSelected] = useState("Sin seleccionar");

  return (
    <div>
      <h1 className="mb-5 text-center text-4xl">Results</h1>
      <div className="mx-auto w-10/12 lg:w-1/2">
        <p>Select a round</p>
        <Select
          onValueChange={(value) => {
            setSelected(value);
          }}
          value={selected}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una ronda" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="1">Ronda 1</SelectItem>
            <SelectItem value="2">Ronda 2</SelectItem>
            <SelectItem value="3">Ronda 3</SelectItem>
          </SelectContent>
        </Select>

        {selected != "Sin seleccionar" && (
          <RoundResults team={team} selection={selected} />
        )}
      </div>
    </div>
  );
};

const RoundResults = ({
  team,
  selection,
}: {
  team: TeamType;
  selection: string;
}) => {
  const challengesA = team?.challengeA;
  const challengesB = team?.challengeB;
  const challengesC = team?.challengeC;

  return (
    <div className="pt-10">
      <div>
        <div className="pb-10">
          <h1 className="pb-2 font-anton text-lg">Challenge A - Ball</h1>
          {challengesA
            ?.filter((challenge) => challenge.roundId === selection)
            .map((challenge, key) => (
              <div key={key} className="px-5">
                <br />
                Finished track: {challenge.finishedTrack ? "Yes" : "No"}
                <br />
                Obtained bonus: {challenge.obtainedBonus ? "Yes" : "No"}
                <br />
                Round time: {challenge.roundTimeSeconds} seconds
                <br />
                Lack of progress: {challenge.lackOfProgress}
                <hr className="py-1" />
                Points: {challenge.points}
              </div>
            ))}
        </div>

        <div className="pb-10">
          <h1 className="pb-2 font-anton text-lg">
            Challenge B - Line Follower
          </h1>
          {challengesB
            ?.filter((challenge) => challenge.roundId === selection)
            .map((challenge, key) => (
              <div key={key} className="px-5">
                Track Points: {challenge.trackPoints}
                <br />
                Patterns Passed:
                <br />
                {challenge.patternsPassed.length === 0 && (
                  <span>No patterns were crossed</span>
                )}
                {challenge.patternsPassed.map((p) => {
                  const pattern = patternData.find(
                    (pattern) => pattern.id === p,
                  );
                  if (!pattern) return null;
                  return (
                    <div
                      key={p}
                      className="relative mx-1 inline-block h-16 w-16"
                    >
                      <Image
                        key={p}
                        src={pattern.src}
                        alt={pattern.alt}
                        fill
                        className="rounded-lg object-contain"
                      />
                    </div>
                  );
                })}
                <br />
                Time: {challenge.roundTimeSeconds} seconds
                <br />
                Lack of progress: {challenge.lackOfProgress}
                <hr className="py-1" />
                Points: {challenge.points}
              </div>
            ))}
        </div>

        <h1 className="pb-2 font-anton text-lg">Challenge C - Maze</h1>
        {challengesC
          ?.filter((challenge) => challenge.roundId === selection)
          .map((challenge, key) => (
            <div key={key} className="px-5">
              Number of detected colors: {challenge.detectedColors}
              <br />
              Passed obstacles: {challenge.passedObstacles}
              <br />
              Finished track: {challenge.finishedTrack ? "Yes" : "No"}
              <br />
              Bonus: {challenge.obtainedBonus ? "Yes" : "No"}
              <br />
              Passed ramp: {challenge.passedRamp ? "Yes" : "No"}
              <br />
              Passed ramp (No lack of progress):{" "}
              {challenge.crossedRampWithoutLOP ? "Yes" : "No"}
              <br />
              Passed ramp (No touching walls):{" "}
              {challenge.crossedRampWithoutTouching ? "Yes" : "No"}
              <br />
              Passed ramp (Reversed): {challenge.reverseRamp ? "Yes" : "No"}
              <br />
              Time: {challenge.roundTimeSeconds} seconds
              <br />
              Lack of progress: {challenge.lackOfProgress}
              <hr className="py-1" />
              Points: {challenge.points}
            </div>
          ))}
      </div>
    </div>
  );
};

export default Results;
