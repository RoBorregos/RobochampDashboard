export type LineupRun = {
  teamId: string;
  teamName: string;
  round: number;
  track: string;
  category: "BEGINNERS" | "ADVANCED" | null;
  start: Date;
};

const SLOT_MS = 10 * 60_000;

/**
 * A GREEN judge takes the odd runs of their track (1st, 3rd...), BLUE the even
 * ones (no colour: every run of the track). `current` is the judge's latest run that has started; it ends (and
 * must be finalized) when the next run of the track, of either colour, starts.
 */
export function judgeAssignment(
  runs: LineupRun[],
  track: string,
  color: "GREEN" | "BLUE" | null | undefined,
  now: number,
) {
  const all = runs
    .filter((r) => r.track === track)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const mine = all.filter((_, i) => !color || (i % 2 === 0) === (color === "GREEN"));

  // The next run of the track ends a run, but never later than its own slot
  // (so a gap like lunch doesn't keep a finished run open).
  const endOf = (run: LineupRun) =>
    Math.min(
      all.find((r) => r.start > run.start)?.start.getTime() ?? Infinity,
      run.start.getTime() + SLOT_MS,
    );
  const current = [...mine].reverse().find((r) => r.start.getTime() <= now) ?? null;
  const next = mine.find((r) => r.start.getTime() > now) ?? null;
  return {
    current,
    endsAt: current ? endOf(current) : null,
    next,
    nextEndsAt: next ? endOf(next) : null,
    /** The run after `next`, shown as "Next" while `next` is on screen. */
    after: next ? (mine[mine.indexOf(next) + 1] ?? null) : null,
  };
}
