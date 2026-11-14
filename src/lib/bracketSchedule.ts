import { ScheduleStatus, type BracketCategory, type PrismaClient } from "@prisma/client";
import events from "../app/_components/events.json";

const MIN = 60_000;
/** 2 min calibration + 8 min execution. */
export const SLOT_MS = 10 * MIN;
export const CALIBRATION_MS = 2 * MIN;

/** Where a run is at `now`: 2 min of calibration, then the 8 min run; null before/after. */
export function runPhase(start: number, now: number) {
  const e = now - start;
  if (e < 0 || e >= SLOT_MS) return null;
  return e < CALIBRATION_MS
    ? { label: "CALIBRATION", left: CALIBRATION_MS - e }
    : { label: "RUNNING", left: SLOT_MS - e };
}

const MANUAL: ScheduleStatus[] = [ScheduleStatus.DELAYED, ScheduleStatus.CANCELLED];

// Status follows the clock; DELAYED/CANCELLED set by a judge/admin override it.
export function withLiveStatus<R extends { time: Date; status: ScheduleStatus; points: number | null }>(
  rows: R[],
  now = Date.now(),
): R[] {
  const t = (r: R) => new Date(r.time).getTime();
  const nextStart = Math.min(
    ...rows.filter((r) => t(r) > now && !MANUAL.includes(r.status)).map(t),
  );
  return rows.map((r) => {
    if (MANUAL.includes(r.status)) return r;
    if (r.points !== null) return { ...r, status: ScheduleStatus.FINALIZED };
    const phase = runPhase(t(r), now);
    if (phase)
      return {
        ...r,
        status: phase.label === "CALIBRATION" ? ScheduleStatus.IN_CALIBRATION : ScheduleStatus.IN_ROUND,
      };
    // time's up with no score: counts as 0 (display only, nothing written)
    if (now >= t(r) + SLOT_MS) return { ...r, status: ScheduleStatus.FINALIZED, points: 0 };
    if (t(r) === nextStart) return { ...r, status: ScheduleStatus.IN_PREPARATION };
    return { ...r, status: ScheduleStatus.ON_TIME };
  });
}

export const mmss = (ms: number) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// The event is one fixed day in GMT-6 (Mexico has no DST), whatever the server's timezone.
export const EVENT_TZ = "America/Mexico_City";
export const EVENT_MIDNIGHT = Date.parse("2026-11-14T00:00:00-06:00");

// Qualification windows read from the agenda in events.json (minutes from midnight), index = round - 1.
export const WINDOWS: Record<BracketCategory, [number, number][]> = { ADVANCED: [], BEGINNERS: [] };
const toMin = (t: string) => {
  const [h, m] = t.trim().split(":").map(Number);
  return h! * 60 + m!;
};
for (const e of events.agenda) {
  const round = /^Round (\d)/.exec(e.activity)?.[1];
  if (!round || (e.category !== "Advanced" && e.category !== "Beginners")) continue;
  const [from, to] = e.time.split("–").map(toMin);
  WINDOWS[e.category.toUpperCase() as BracketCategory][Number(round) - 1] = [from!, to!];
}

/** "HH:MM" on the event day, in event time. */
export const eventTime = (hhmm: string) => new Date(EVENT_MIDNIGHT + toMin(hhmm) * MIN);
export const hhmm = (d: Date) =>
  d.toLocaleTimeString("en-GB", { timeZone: EVENT_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const windowStart = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Balanced groups of at most 4, in the given order (default grouping when no bracket is saved). */
export function groupsOf(names: string[]) {
  const count = Math.ceil(names.length / 4);
  const out: string[][] = [];
  for (let g = 0, from = 0; g < count; g++) {
    const size = Math.floor(names.length / count) + (g < names.length % count ? 1 : 0);
    out.push(names.slice(from, (from += size)));
  }
  return out;
}

export type Run = { team: string; round: number; track: "A" | "B"; start: Date };

/**
 * Odd groups (1, 3, ...) run track A, even groups (2, 4, ...) track B. Each
 * track queues its teams by position (every group's first team, then every
 * group's second...), and slot i starts the i-th team of both tracks together.
 * So groups 1+2 go first, then 3+4. Both rounds use the same layout.
 */
export function buildRuns(
  groups: string[][],
  category: BracketCategory,
  shiftMs = 0,
  starts: string[] = [], // optional per-round start "HH:MM" overriding the agenda; the window length is kept
) {
  const queue = (parity: number) => {
    const gs = groups.filter((_, i) => i % 2 === parity);
    const out: string[] = [];
    for (let k = 0; k < Math.max(0, ...gs.map((g) => g.length)); k++)
      for (const g of gs) if (g[k]) out.push(g[k]!);
    return out;
  };
  const queues = { A: queue(0), B: queue(1) };
  const runs: Run[] = [];
  const warnings: string[] = [];

  WINDOWS[category].forEach(([agendaFrom, to], r) => {
    const from = starts[r] ? toMin(starts[r]) : agendaFrom;
    to += from - agendaFrom;
    const slots = Math.max(queues.A.length, queues.B.length);
    if (slots * SLOT_MS > (to - from) * MIN)
      warnings.push(
        `${category} round ${r + 1}: ${slots} slots need ${slots * 10} min, window is ${to - from} min`,
      );
    for (const track of ["A", "B"] as const)
      queues[track].forEach((team, i) =>
        runs.push({
          team,
          round: r + 1,
          track,
          start: new Date(EVENT_MIDNIGHT + from * MIN + i * SLOT_MS + shiftMs),
        }),
      );
  });
  return { runs, warnings };
}

/** Replaces the category's stored schedule with the one its bracket groups imply. */
export async function syncSchedule(
  db: PrismaClient,
  category: BracketCategory,
  groups: string[][],
  shiftMs = 0,
  starts: string[] = [],
) {
  const { runs, warnings } = buildRuns(groups, category, shiftMs, starts);
  const teams = await db.team.findMany({
    where: { name: { in: groups.flat() } },
    select: { id: true, name: true },
  });
  const id = new Map(teams.map((t) => [t.name, t.id]));
  await db.round.deleteMany({ where: { team: { category } } });
  for (const run of runs) {
    const teamId = id.get(run.team);
    if (!teamId) continue;
    await db.round.create({
      data: {
        teamId,
        number: run.round,
        isVisible: true,
        challenges: {
          create: { name: `Pista ${run.track}`, time: run.start, initialTime: run.start },
        },
      },
    });
  }
  return { runs: runs.length, warnings };
}
