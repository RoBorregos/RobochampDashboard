"use client";

import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

// Ported from CandidatesDashboard's TrackRunFields RunTimer.

export const CALIBRATION_MS = 2 * 60_000;

/** "1:23.4": minutes, seconds and tenths. */
export const formatClock = (ms: number) => {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor(tenths / 10) % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
};

/** Server-corrected Date.now(), refreshed every frame. */
function useFrameClock(offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let id = 0;
    const tick = () => {
      setNow(Date.now());
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  return now + offset;
}

export type TimerState = {
  /** Segment (calibration + run) started by hand instead of by the schedule. */
  startedAt: number | null;
  /** Run clock started by hand ("Skip calibration"). */
  runStartedAt: number | null;
  stoppedAt: number | null;
};

export const freshTimer: TimerState = { startedAt: null, runStartedAt: null, stoppedAt: null };

/** Derived clock values shared by the timer and the form's round time. */
export function timerMath(timer: TimerState, scheduledStart: number | null, maxMs: number) {
  const segmentStart = timer.startedAt ?? scheduledStart;
  const anchor =
    timer.runStartedAt ?? (segmentStart === null ? null : segmentStart + CALIBRATION_MS);
  const elapsedAt = (at: number) =>
    anchor === null ? 0 : Math.min(Math.max((timer.stoppedAt ?? at) - anchor, 0), maxMs);
  return { segmentStart, anchor, elapsedAt };
}

/**
 * M:SS.d clocks for one segment. The big one counts calibration down from 2:00
 * (green), then the run up (gray); the small one is the total since the segment
 * started. Before the segment it counts down negative to the start; once the run
 * is over it counts down negative to the next match on the track (blue).
 */
export function RunTimer({
  timer,
  setTimer,
  scheduledStart,
  nextMatchAt,
  maxMs,
  offset,
  locked,
  action,
  onCancel,
  cancelled,
}: {
  timer: TimerState;
  setTimer: (update: (t: TimerState) => TimerState) => void;
  scheduledStart: number | null;
  nextMatchAt: number | null;
  maxMs: number;
  offset: number;
  /** Another judge just pressed a timer button. */
  locked?: boolean;
  /** Small read-only clock with just this button (a judge of the other colour watching). */
  action?: { label: string; onClick: () => void };
  /** Cancels the run (its round scores 0); only offered for scheduled runs. */
  onCancel?: () => void;
  cancelled?: boolean;
}) {
  const at = useFrameClock(offset);
  const clock = () => Date.now() + offset;
  const { segmentStart, anchor, elapsedAt } = timerMath(timer, scheduledStart, maxMs);
  const stopped = timer.stoppedAt !== null;

  let phase: "idle" | "waiting" | "calibration" | "run" | "cooldown";
  // A cancelled run goes straight to the cooldown before the next match, whatever phase it was in.
  if (cancelled && nextMatchAt !== null && at < nextMatchAt) phase = "cooldown";
  else if (anchor === null || segmentStart === null) phase = "idle";
  else if (at < segmentStart) phase = "waiting";
  else if (!stopped && at < anchor) phase = "calibration";
  else if ((stopped || elapsedAt(at) >= maxMs) && nextMatchAt !== null && at < nextMatchAt)
    phase = "cooldown";
  else phase = "run";

  let label = "Stopwatch";
  let ms = 0;
  let limit: number | null = null;
  let tone = "text-neutral-300";
  let labelTone = "text-neutral-400";
  if (phase === "waiting") {
    label = "Starts in";
    ms = segmentStart! - at;
    tone = "text-neutral-500";
  } else if (phase === "calibration") {
    label = "Calibration";
    ms = anchor! - at;
    limit = CALIBRATION_MS;
    tone = "text-green-400";
  } else if (phase === "cooldown") {
    label = cancelled ? "Cooldown · run cancelled" : stopped ? "Cooldown · round ended" : "Cooldown";
    ms = nextMatchAt! - at;
    tone = "text-sky-400";
    labelTone = "text-sky-400";
  } else if (phase === "run") {
    ms = elapsedAt(at);
    limit = maxMs;
    if (cancelled) label = "Run cancelled";
    else if (stopped) label = "Round ended";
    else if (ms >= maxMs) {
      label = "Time's up";
      labelTone = "text-red-400";
    } else label = "Run time";
  }

  // Real time since the segment started, until the run's time is up.
  const total =
    segmentStart !== null && anchor !== null && at >= segmentStart
      ? Math.min(at, anchor + maxMs) - segmentStart
      : null;

  const startRunNow = () => setTimer((t) => ({ ...t, runStartedAt: clock(), stoppedAt: null }));
  const skipCalibration = () => {
    if (
      window.confirm(
        `Skip the rest of calibration (${formatClock(anchor! - at).slice(0, -2)} left) and start the run now?`,
      )
    )
      startRunNow();
  };
  const cancelRun = () => {
    if (window.prompt('Cancel this run? The round will score 0 points. Type "CANCEL" to confirm.') === "CANCEL")
      onCancel?.();
  };
  // Freezes the run time for scoring: once ended, the timer can't be resumed or reset.
  const endRound = () => {
    if (window.confirm(`End the round at ${formatClock(elapsedAt(at))}? The run time is final.`))
      setTimer((t) => ({ ...t, stoppedAt: clock() }));
  };

  const button =
    "h-12 flex-1 rounded-lg border-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:grayscale";

  return (
    <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
      <span className={cn("text-xs uppercase tracking-widest", labelTone)}>{label}</span>
      <div className="flex items-end justify-between gap-3">
        <p className={cn("font-digital tabular-nums leading-tight", action ? "text-3xl" : "text-6xl", tone)}>
          {(phase === "cooldown" || phase === "waiting") && "-"}
          {formatClock(ms)}
          {limit !== null && (
            <span className="text-2xl text-neutral-600"> / {formatClock(limit).slice(0, -2)}</span>
          )}
        </p>
        {phase === "cooldown" ? (
          <p className="shrink-0 pb-1 text-right font-digital tabular-nums text-neutral-400">
            <span className="block text-[10px] uppercase tracking-widest">Run time</span>
            <span className="text-2xl">{formatClock(elapsedAt(at))}</span>
          </p>
        ) : (
          total !== null && (
            <p className="shrink-0 pb-1 text-right font-digital tabular-nums text-neutral-600">
              <span className="block text-[10px] uppercase tracking-widest">Total</span>
              <span className="text-2xl">{formatClock(total)}</span>
            </p>
          )
        )}
      </div>
      <fieldset disabled={!!locked || !!cancelled} className="mt-2 flex gap-2">
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className={cn(button, "border-amber-400 bg-amber-400/20")}
          >
            {action.label}
          </button>
        ) : phase === "idle" || phase === "waiting" ? (
          <button
            type="button"
            onClick={() =>
              setTimer(() => ({ startedAt: clock(), runStartedAt: null, stoppedAt: null }))
            }
            className={cn(button, "border-roboblue bg-roboblue/20")}
          >
            {phase === "idle" ? "Start" : "Start now"}
          </button>
        ) : phase === "calibration" ? (
          <button
            type="button"
            onClick={skipCalibration}
            className={cn(button, "border-green-500 bg-green-500/20")}
          >
            Skip calibration
          </button>
        ) : stopped ? null : (
          <button
            type="button"
            onClick={endRound}
            className={cn(button, "border-red-500 bg-red-500/20")}
          >
            End Round
          </button>
        )}
        {!action && onCancel && (
          <button
            type="button"
            onClick={cancelRun}
            disabled={cancelled}
            className={cn(button, "border-red-700 text-red-400")}
          >
            {cancelled ? "Run cancelled" : "Cancel run"}
          </button>
        )}
        {!action && !stopped && (timer.startedAt !== null || timer.runStartedAt !== null) && (
          <button
            type="button"
            onClick={() => setTimer(() => freshTimer)}
            className={cn(button, "border-neutral-700 text-neutral-300")}
          >
            {scheduledStart !== null ? "Use schedule" : "Reset"}
          </button>
        )}
      </fieldset>
    </div>
  );
}
