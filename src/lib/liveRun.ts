import { z } from "zod";
import { MARS_LIMITS } from "./marsScoring";

// Live state of one scheduled run, shared by every judge watching it (timer, counts, button locks).

/** Supabase Realtime channel: pings only (payload: the run key), never the state itself. */
export const LIVE_CHANNEL = "judge-live";

/** After a judge changes a field, other judges can't touch it for this long. */
export const LOCK_MS = 1000;
export const LOP_LOCK_MS = 3000;

const COUNTERS = ["panels", "speedBumps", "stairs", "seeds"] as const;
const ms = z.number().nullable();

export const liveOpSchema = z.union([
  z.object({ field: z.enum(COUNTERS), value: z.number().int().min(0).max(10) }),
  z.object({ field: z.literal("lackOfProgress"), value: z.number().int().min(0).max(1000) }),
  z.object({ field: z.literal("seesawCrossed"), value: z.boolean() }),
  z.object({ field: z.literal("category"), value: z.enum(["BEGINNERS", "ADVANCED"]) }),
  z.object({
    field: z.literal("timer"),
    value: z.object({ startedAt: ms, runStartedAt: ms, stoppedAt: ms }),
  }),
]);
export type LiveOp = z.infer<typeof liveOpSchema>;
export type LiveField = LiveOp["field"];

export type LiveState = {
  values: Partial<Record<LiveField, unknown>>;
  locks: Partial<Record<LiveField, { until: number; by: string }>>;
};
export const emptyLive: LiveState = { values: {}, locks: {} };

/**
 * One judge's change, or null when refused: another judge holds the field's
 * lock, or `from` isn't the latest value (they decided on a stale screen).
 */
export function applyLive(
  s: LiveState,
  op: LiveOp & { from?: unknown },
  by: string,
  now: number,
): LiveState | null {
  const lock = s.locks[op.field];
  if (lock && lock.by !== by && lock.until > now) return null;
  if (JSON.stringify(s.values[op.field]) !== JSON.stringify(op.from)) return null;
  const values: LiveState["values"] = { ...s.values, [op.field]: op.value };
  // Switching category lowers the caps, so clamp counts that would exceed them.
  if (op.field === "category")
    for (const k of COUNTERS)
      if (values[k] !== undefined) values[k] = Math.min(Number(values[k]), MARS_LIMITS[op.value][k]);
  const until = now + (op.field === "lackOfProgress" ? LOP_LOCK_MS : LOCK_MS);
  return { values, locks: { ...s.locks, [op.field]: { until, by } } };
}
