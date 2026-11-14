import type { BracketCategory, PrismaClient } from "@prisma/client";

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

export const mmss = (ms: number) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Qualification windows from src/app/_components/events.json (minutes from midnight).
export const WINDOWS: Record<BracketCategory, [number, number][]> = {
  ADVANCED: [[570, 660], [670, 760]], // 9:30-11:00, 11:10-12:40
  BEGINNERS: [[760, 840], [900, 980]], // 12:40-14:00, 15:00-16:20
};

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
  day = new Date(),
  shiftMs = 0,
) {
  const queue = (parity: number) => {
    const gs = groups.filter((_, i) => i % 2 === parity);
    const out: string[] = [];
    for (let k = 0; k < Math.max(0, ...gs.map((g) => g.length)); k++)
      for (const g of gs) if (g[k]) out.push(g[k]!);
    return out;
  };
  const queues = { A: queue(0), B: queue(1) };
  const midnight = new Date(day).setHours(0, 0, 0, 0);
  const runs: Run[] = [];
  const warnings: string[] = [];

  WINDOWS[category].forEach(([from, to], r) => {
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
          start: new Date(midnight + from * MIN + i * SLOT_MS + shiftMs),
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
) {
  const { runs, warnings } = buildRuns(groups, category, new Date(), shiftMs);
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
