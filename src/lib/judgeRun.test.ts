import assert from "node:assert";
import { judgeAssignment, type LineupRun } from "./judgeRun";

const run = (n: number, min: number): LineupRun => ({
  teamId: `t${n}`, teamName: `T${n}`, round: 1, track: "A", category: "ADVANCED", start: new Date(min * 60_000),
});
const runs = [run(1, 0), run(2, 10), run(3, 20), { ...run(9, 5), track: "B" }];
const min = (m: number) => m * 60_000;

const g = judgeAssignment(runs, "A", "GREEN", min(12));
assert.equal(g.current?.teamId, "t1");
assert.equal(g.endsAt, min(10)); // team 2 started -> green's team 1 is over
assert.equal(g.next?.teamId, "t3");

const b = judgeAssignment(runs, "A", "BLUE", min(12));
assert.equal(b.current?.teamId, "t2");
assert.equal(b.endsAt, min(20));
assert.equal(judgeAssignment(runs, "A", "BLUE", min(5)).current, null);
console.log("ok");
