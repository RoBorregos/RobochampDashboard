"use client";

import type { JudgeColor } from "@prisma/client";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

const COLORS = {
  GREEN: "border-green-500 text-green-400",
  BLUE: "border-blue-500 text-blue-400",
} as const;

export function JudgeRuns() {
  const utils = api.useUtils();
  const { data } = api.judge.me.useQuery();

  // Optimistic: flip the button instantly, roll back on error, no refetch needed on success.
  const opts = <V,>(label: string, patch: (v: V) => Partial<NonNullable<typeof data>>) => ({
    async onMutate(v: V) {
      await utils.judge.me.cancel();
      const prev = utils.judge.me.getData();
      utils.judge.me.setData(undefined, (d) => ({ judgeColor: null, judgeTrack: null, ...d, ...patch(v) }));
      return { prev };
    },
    onSuccess: () => toast.success(label),
    onError(_e: unknown, _v: unknown, ctx?: { prev?: typeof data }) {
      utils.judge.me.setData(undefined, ctx?.prev);
      toast.error("No se pudo guardar, intenta de nuevo.");
    },
  });
  const setColor = api.judge.setColor.useMutation(opts("Color guardado", (v: { color: JudgeColor }) => ({ judgeColor: v.color })));
  const setTrack = api.judge.setTrack.useMutation(opts("Pista guardada", (v: { track: string }) => ({ judgeTrack: v.track })));

  return (
    <div className="mx-auto mb-6 space-y-3 lg:w-1/2">
      <div className="grid grid-cols-2 gap-2">
        {(["A", "B"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={data?.judgeTrack === t}
            onClick={() => setTrack.mutate({ track: t })}
            className={cn(
              "min-h-12 rounded-lg border-2 font-medium",
              data?.judgeTrack === t ? "border-white bg-white text-black" : "border-neutral-700 text-neutral-500",
            )}
          >
            Pista {t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["GREEN", "BLUE"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={data?.judgeColor === c}
            onClick={() => setColor.mutate({ color: c })}
            className={cn(
              "min-h-12 rounded-lg border-2 font-medium",
              data?.judgeColor === c ? cn(COLORS[c], "bg-neutral-800") : "border-neutral-700 text-neutral-500",
            )}
          >
            {c === "GREEN" ? "Verde (impares)" : "Azul (pares)"}
          </button>
        ))}
      </div>
    </div>
  );
}
