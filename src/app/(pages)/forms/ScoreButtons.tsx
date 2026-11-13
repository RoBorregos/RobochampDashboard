"use client";

import { cn } from "~/lib/utils";

/*
 * Large tap targets for the 2026 judge forms: judges score while watching
 * the robot, so every input is one tap and big enough to hit on a phone.
 */

/** Tap anywhere to add one; the small "−" undoes a mistaken tap. */
export function CounterButton({
  label,
  count,
  max,
  points,
  onChange,
}: {
  label: string;
  count: number;
  max?: number;
  points?: number;
  onChange: (count: number) => void;
}) {
  const full = max !== undefined && count >= max;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onChange(full ? count : count + 1)}
        className={cn(
          "flex min-h-32 w-full select-none flex-col justify-between gap-2 rounded-lg border-2 p-4 pr-16 text-left transition active:scale-[0.98]",
          full
            ? "border-green-500 bg-green-500/10"
            : count > 0
              ? "border-roboblue bg-roboblue/20"
              : "border-neutral-700 bg-neutral-900 hover:border-neutral-500",
        )}
      >
        <span className="text-sm font-medium leading-tight">{label}</span>
        <span className="font-digital text-6xl leading-none">
          {count}
          {max !== undefined && (
            <span className="text-2xl text-neutral-500"> / {max}</span>
          )}
        </span>
        <span className="text-xs text-neutral-400">
          {points !== undefined
            ? `+${points} each · ${count * points} pts`
            : "Tap to add one"}
          {full && " · max reached"}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Remove one: ${label}`}
        onClick={() => onChange(Math.max(0, count - 1))}
        disabled={count === 0}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-neutral-600 bg-black text-2xl leading-none hover:border-white disabled:opacity-30"
      >
        −
      </button>
    </div>
  );
}

/** One-tap yes/no item. */
export function ToggleButton({
  label,
  points,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  points: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "flex min-h-20 w-full select-none items-center gap-4 rounded-lg border-2 p-4 text-left transition active:scale-[0.98] disabled:opacity-40",
        checked
          ? "border-green-500 bg-green-500/10"
          : "border-neutral-700 bg-neutral-900 hover:border-neutral-500",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 text-lg",
          checked
            ? "border-green-500 bg-green-500 text-black"
            : "border-neutral-500",
        )}
      >
        {checked ? "✓" : ""}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium leading-tight">{label}</span>
        {hint && <span className="block text-xs text-neutral-400">{hint}</span>}
      </span>
      <span
        className={cn(
          "font-digital text-2xl",
          checked ? "text-green-400" : "text-neutral-500",
        )}
      >
        +{points}
      </span>
    </button>
  );
}

/** Pick exactly one of a few outcomes, e.g. how a checkpoint was reached. */
export function ChoiceButtons<V extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: readonly { value: V; label: string; points: number }[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex min-h-20 select-none flex-col items-center justify-center gap-1 rounded-lg border-2 p-2 text-center text-xs transition active:scale-[0.97]",
                selected
                  ? option.points > 0
                    ? "border-green-500 bg-green-500/10"
                    : "border-white bg-neutral-800"
                  : "border-neutral-700 bg-neutral-900 hover:border-neutral-500",
              )}
            >
              <span className="leading-tight">{option.label}</span>
              <span
                className={cn(
                  "font-digital text-2xl",
                  selected ? "text-white" : "text-neutral-500",
                )}
              >
                +{option.points}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
