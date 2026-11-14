"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import Select from "react-select";

import { Button } from "~/app/_components/shadcn/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "rbrgs/app/_components/shadcn/ui/form";
import { marsSchema } from "rbrgs/lib/schemas";
import {
  MARS_LIMITS,
  MARS_POINTS,
  MARS_ROUND_SECONDS,
  computeMarsPoints,
} from "rbrgs/lib/marsScoring";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { RunTimer, freshTimer, timerMath, type TimerState } from "./RunTimer";
import type { LineupRun } from "~/lib/judgeRun";
import { CounterButton, ToggleButton } from "./ScoreButtons";
import { useSession } from "next-auth/react";
import type { LiveField, LiveOp } from "~/lib/liveRun";
import { useLiveRun } from "./useLiveRun";

/** Live state key of a scheduled run, shared by every judge on it (either colour). */
export const liveKey = (run: LineupRun) => `${run.teamId}:${run.round}`;

const formField = (field: LiveField) =>
  field === "lackOfProgress" ? "genericFormSchema.lackOfProgress" : (field as Exclude<LiveField, "lackOfProgress" | "timer">);

type FormData = z.infer<typeof marsSchema>;

const COUNTERS = [
  { name: "panels", label: "Panels restored (Zone 1)" },
  { name: "speedBumps", label: "Speed-bumps crossed" },
  { name: "stairs", label: "Stairs crossed" },
  { name: "seeds", label: "Seeds planted" },
] as const;

const CATEGORIES = { BEGINNERS: "Principiantes", ADVANCED: "Avanzados" } as const;

type AutoProps = {
  run?: LineupRun;
  now?: number;
  /** When the next run on the track starts: the evaluation auto-finalizes then. */
  endsAt?: number;
  /** Server clock minus device clock. */
  offset?: number;
  next?: LineupRun | null;
};

export const FormChallengeMars = ({
  teamId = "",
  run,
  now = 0,
  endsAt,
  offset = 0,
  next,
}: { teamId?: string } & AutoProps) => {
  const form = useForm<FormData>({
    resolver: zodResolver(marsSchema),
    defaultValues: {
      category: "BEGINNERS",
      panels: 0,
      speedBumps: 0,
      stairs: 0,
      seeds: 0,
      seesawCrossed: false,
      genericFormSchema: { obtainedBonus: false, roundTimeSeconds: 0, lackOfProgress: 0 },
    },
  });

  const values = form.watch();
  const limits = MARS_LIMITS[values.category];
  // Max without the time bonus (perfect run at the buzzer): 150 beginners, 190 advanced.
  const maxPoints = computeMarsPoints(
    values.category,
    { ...MARS_LIMITS[values.category], seesawCrossed: true },
    MARS_ROUND_SECONDS,
  );
  const preview = computeMarsPoints(
    values.category,
    {
      panels: Number(values.panels),
      speedBumps: Number(values.speedBumps),
      stairs: Number(values.stairs),
      seeds: Number(values.seeds),
      seesawCrossed: values.seesawCrossed,
    },
    Number(values.genericFormSchema.roundTimeSeconds) || 0,
  );

  const { data: teamIds, isLoading } = api.team.getTeamIds.useQuery();
  // A run picked from the judge's assignment panel pre-fills the team.
  useEffect(() => {
    if (teamId) form.setValue("genericFormSchema.teamId", teamId);
  }, [teamId, form]);
  // A scheduled run syncs counts, timer and button locks with the other judges on it;
  // a hand-picked one stays local to this page.
  const key = run ? liveKey(run) : null;
  const me = useSession().data?.user?.id;
  const utils = api.useUtils();
  const live = useLiveRun(key).data?.live;
  // Re-render when the soonest lock expires, so its button un-grays on time.
  const [, rerender] = useState(0);
  useEffect(() => {
    const wait = Math.min(...Object.values(live?.locks ?? {}).map((l) => l.until)) - (Date.now() + offset);
    if (!(wait > 0 && wait < 10_000)) return;
    const id = setTimeout(() => rerender((n) => n + 1), wait + 50);
    return () => clearTimeout(id);
  }, [live, offset]);
  const liveSet = api.judge.liveSet.useMutation({
    async onMutate(op) {
      await utils.judge.live.cancel({ key: op.key });
      utils.judge.live.setData({ key: op.key }, (d) =>
        d && { ...d, live: { ...d.live, values: { ...d.live.values, [op.field]: op.value } } },
      );
    },
    onSuccess(res, op) {
      utils.judge.live.setData({ key: op.key }, res);
      if (!res.ok) toast("Otro juez acaba de cambiar esto, ya se sincronizó.");
    },
    onError(error, op) {
      void utils.judge.live.invalidate({ key: op.key });
      toast.error("No se pudo sincronizar, intenta de nuevo.");
      console.error(error);
    },
  });
  const write = <F extends LiveField>(field: F, value: Extract<LiveOp, { field: F }>["value"]) => {
    if (key) liveSet.mutate({ key, field, value, from: live?.values[field] } as Parameters<typeof liveSet.mutate>[0]);
    else form.setValue(formField(field), value as never);
  };
  // Grayed out for a moment after another judge taps it (server-enforced too).
  const locked = (field: LiveField) => {
    const l = live?.locks[field];
    return !!l && l.by !== me && l.until > Date.now() + offset;
  };
  useEffect(() => {
    if (!live) return;
    for (const field of ["panels", "speedBumps", "stairs", "seeds", "seesawCrossed", "lackOfProgress"] as const) {
      const v = live.values[field];
      if (v !== undefined && form.getValues(formField(field)) !== v) form.setValue(formField(field), v as never);
    }
  }, [live, form]);
  const [localTimer, setLocalTimer] = useState<TimerState>(freshTimer);
  const timer = key ? ((live?.values.timer as TimerState | undefined) ?? freshTimer) : localTimer;
  const setTimer = (update: (t: TimerState) => TimerState) =>
    key ? write("timer", update(timer)) : setLocalTimer(update);
  const { anchor, elapsedAt } = timerMath(timer, run?.start.getTime() ?? null, MARS_ROUND_SECONDS * 1000);
  const cancelled = !!live?.values.cancelled;
  const cancelRun = api.judge.cancelRun.useMutation({
    onSuccess() {
      toast("Corrida cancelada: la ronda vale 0 puntos.");
      if (key) void utils.judge.live.invalidate({ key });
    },
    onError(error) {
      toast.error("No se pudo cancelar la corrida, intenta de nuevo.");
      console.error(error);
    },
  });
  const [finalized, setFinalized] = useState(false);
  // Only finalize a run this page saw live; opening it late must not save a blank score.
  const armed = useRef(endsAt === undefined || now < endsAt);
  const over = endsAt !== undefined && now >= endsAt;
  useEffect(() => {
    if (!run) return;
    form.setValue("genericFormSchema.teamId", run.teamId);
    form.setValue("genericFormSchema.roundId", String(run.round));
  }, [run, form]);
  // The run clock fills the round time until the judge stops it.
  useEffect(() => {
    if (anchor === null || finalized) return;
    const secs = Math.floor(elapsedAt(now) / 1000);
    // setValue re-renders via watch(), and elapsedAt is new every render: only write changes.
    if (Number(form.getValues("genericFormSchema.roundTimeSeconds")) !== secs)
      form.setValue("genericFormSchema.roundTimeSeconds", secs);
  }, [anchor, elapsedAt, now, finalized, form]);
  const options = teamIds?.map((t) => ({ value: t.id, label: t.name })) ?? [];
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  const deleteEvaluation = api.judge.roundMarsDelete.useMutation({
    onError(error) {
      toast("Hubo un error al borrar la evaluación, checar consola.");
      console.error(error);
    },
  });

  const createEvaluation = api.judge.roundMars.useMutation({
    onSuccess(data) {
      toast("Se ha procesado la evaluación!", {
        description: <p>Puntos calculados: {data.points}</p>,
        action: {
          label: "Undo",
          onClick: () => {
            deleteEvaluation.mutate({ id: data.id });
            setLastCreatedId(null);
          },
        },
      });
      setLastCreatedId(data.id);
    },
    onError(error) {
      toast("Hubo un error al crear la evaluación, checar consola.");
      console.error(error);
    },
  });

  useEffect(() => {
    // Cancelling ends the round right away (the server saves it as 0 points).
    if (!(over || cancelled) || finalized) return;
    setFinalized(true);
    if (armed.current)
      void form.handleSubmit((data) => createEvaluation.mutate(data))();
  }, [over, cancelled, finalized, form, createEvaluation]);

  // The rubric follows the selected team's category; a lower cap clamps counts that exceed it.
  const teamCategory =
    run?.category ?? teamIds?.find((t) => t.id === values.genericFormSchema.teamId)?.category ?? null;
  useEffect(() => {
    if (!teamCategory || form.getValues("category") === teamCategory) return;
    form.setValue("category", teamCategory);
    for (const { name } of COUNTERS)
      form.setValue(name, Math.min(Number(form.getValues(name)), MARS_LIMITS[teamCategory][name]));
  }, [teamCategory, form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => createEvaluation.mutate(data))}
        className="w-full space-y-4 text-white"
      >
        <div className="sticky top-16 z-10 -mx-3 -mt-3 border-b border-neutral-800 bg-black/95 p-3 backdrop-blur">
          <div className="flex items-baseline justify-between text-xs uppercase tracking-widest text-neutral-400">
            <span>Pista {run?.track ?? "—"}</span>
            <span>Round {run?.round ?? "—"}</span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-neutral-400">
                {!run
                  ? "Picked by hand"
                  : cancelled
                    ? "Cancelled · scores 0"
                    : finalized
                    ? "Finalized"
                    : now < run.start.getTime()
                      ? `Up next · starts ${run.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "On track · finalizes when the next team starts"}
              </p>
              <p className="truncate text-2xl font-bold">
                {run?.teamName ?? options.find((o) => o.value === values.genericFormSchema.teamId)?.label ?? "—"}
              </p>
            </div>
            <p className="shrink-0 font-digital text-4xl text-roboblue">
              {cancelled ? 0 : preview}
              <span className="text-xl text-neutral-500"> / {maxPoints}</span>
            </p>
          </div>
          <RunTimer
            timer={timer}
            setTimer={setTimer}
            scheduledStart={run?.start.getTime() ?? null}
            nextMatchAt={endsAt ?? null}
            maxMs={MARS_ROUND_SECONDS * 1000}
            offset={offset}
            locked={locked("timer")}
            onCancel={run && (() => cancelRun.mutate({ teamId: run.teamId, round: run.round }))}
            cancelled={cancelled}
          />
          {run && (
            <p className="mt-2 text-xs text-neutral-400">
              Next:{" "}
              {next ? (
                <>
                  <span className="text-white">{next.teamName}</span> ·{" "}
                  {next.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (round {next.round})
                </>
              ) : (
                "no more runs on this track"
              )}
            </p>
          )}
        </div>
        <fieldset disabled={cancelled} className="space-y-4 disabled:opacity-40">
        <p className={cn("rounded-lg border-2 p-3 text-center font-medium", teamCategory ? "border-white" : "border-red-500 text-red-400")}>
          {teamCategory
            ? `Rúbrica: ${CATEGORIES[teamCategory]}`
            : "Elige un equipo para cargar su rúbrica (el equipo debe tener categoría)."}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {COUNTERS.filter(({ name }) => limits[name] > 0).map(
            ({ name, label }) => (
              <CounterButton
                key={name}
                label={label}
                count={Number(values[name])}
                max={limits[name]}
                points={MARS_POINTS[name]}
                onChange={(count) => write(name, count)}
                locked={locked(name)}
              />
            ),
          )}
        </div>
        <ToggleButton
          label="Crossed the seesaw (sube y baja)"
          points={MARS_POINTS.seesaw}
          checked={values.seesawCrossed}
          onChange={(checked) => write("seesawCrossed", checked)}
          disabled={locked("seesawCrossed")}
        />

        {/* Per the rules a lack of progress costs no points: the robot just goes back to its last checkpoint. */}
        <CounterButton
          label="Lack of progress (back to last checkpoint, no points lost)"
          count={Number(values.genericFormSchema.lackOfProgress) || 0}
          onChange={(count) => write("lackOfProgress", count)}
          locked={locked("lackOfProgress")}
        />
        <p className="text-sm text-neutral-400">
          Round time (from the run timer):{" "}
          <span className="font-digital text-xl text-white">
            {Number(values.genericFormSchema.roundTimeSeconds) || 0}
          </span>{""}
          s / {MARS_ROUND_SECONDS}s · time left is +1 pt/sec only with a perfect score.
        </p>
        </fieldset>
        <FormField
          control={form.control}
          name="genericFormSchema.teamId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team</FormLabel>
              <FormControl>
                <Select
                  value={options.find((o) => o.value === field.value) ?? null}
                  isLoading={isLoading}
                  isClearable
                  isSearchable
                  placeholder="Elegir un equipo"
                  onChange={(option) =>
                    form.setValue("genericFormSchema.teamId", option?.value ?? "")
                  }
                  options={options}
                  styles={{
                    control: (p) => ({ ...p, backgroundColor: "black", cursor: "pointer" }),
                    menu: (p) => ({ ...p, backgroundColor: "black" }),
                    option: (p, s) => ({
                      ...p,
                      backgroundColor: s.isFocused ? "#333" : "black",
                      color: "white",
                      cursor: "pointer",
                    }),
                    singleValue: (p) => ({ ...p, color: "white" }),
                    placeholder: (p) => ({ ...p, color: "white" }),
                    input: (p) => ({ ...p, color: "white" }),
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!!run && finalized}>Submit</Button>
          {lastCreatedId && (
            <Button
              variant="destructive"
              type="button"
              onClick={() =>
                deleteEvaluation.mutate(
                  { id: lastCreatedId },
                  {
                    onSuccess() {
                      toast("Se deshizo el último resultado.");
                      setLastCreatedId(null);
                    },
                  },
                )
              }
            >
              Undo last
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
};
