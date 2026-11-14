import assert from "node:assert";
import { applyLive, emptyLive, LOCK_MS, LOP_LOCK_MS } from "./liveRun";

const a = applyLive(emptyLive, { field: "panels", value: 1, from: undefined }, "A", 0)!;
assert.equal(a.values.panels, 1);
// Another judge is locked out for a second, the same judge is not.
assert.equal(applyLive(a, { field: "panels", value: 2, from: 1 }, "B", LOCK_MS - 1), null);
assert.ok(applyLive(a, { field: "panels", value: 2, from: 1 }, "A", 1));
assert.ok(applyLive(a, { field: "panels", value: 2, from: 1 }, "B", LOCK_MS));
// Other fields stay free.
assert.ok(applyLive(a, { field: "seeds", value: 1, from: undefined }, "B", 1));
// Stale value: B decided on a screen that hadn't seen A's tap.
assert.equal(applyLive(a, { field: "panels", value: 1, from: undefined }, "B", LOCK_MS), null);
// Lack of progress locks for three seconds.
const l = applyLive(emptyLive, { field: "lackOfProgress", value: 1, from: undefined }, "A", 0)!;
assert.equal(applyLive(l, { field: "lackOfProgress", value: 2, from: 1 }, "B", LOP_LOCK_MS - 1), null);
// Category change clamps counts.
const s = applyLive({ values: { stairs: 2, category: "ADVANCED" }, locks: {} }, { field: "category", value: "BEGINNERS", from: "ADVANCED" }, "A", 0)!;
assert.equal(s.values.stairs, 0);
console.log("liveRun ok");
