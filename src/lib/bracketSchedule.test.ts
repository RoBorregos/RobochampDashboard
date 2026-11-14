import assert from "node:assert";
import { buildRuns } from "./bracketSchedule";

const g = [["a1", "a2"], ["b1", "b2"], ["c1"], ["d1", "d2"]];
const { runs } = buildRuns(g, "ADVANCED", new Date(2026, 0, 1));
const r1 = runs.filter((r) => r.round === 1);
const at = (t: string) => r1.filter((r) => r.team === t)[0]!;
assert.equal(at("a1").track, "A");
assert.equal(at("b1").track, "B");
assert.equal(at("a1").start.getTime(), at("b1").start.getTime()); // groups 1+2 first
assert.equal(at("c1").start.getTime() - at("a1").start.getTime(), 600_000); // then 3+4
assert.equal(at("d1").start.getTime(), at("c1").start.getTime());
assert.ok(at("a2").start > at("d1").start); // second teams after every first team
assert.equal(runs.length, 14); // 7 teams x 2 rounds
console.log("ok");
