"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import Select from "react-select";

import { Button } from "~/app/_components/shadcn/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "rbrgs/app/_components/shadcn/ui/form";
import { Input } from "rbrgs/app/_components/shadcn/ui/input";
import { marsSchema } from "rbrgs/lib/schemas";
import {
  MARS_LIMITS,
  MARS_POINTS,
  MARS_ROUND_SECONDS,
  computeMarsPoints,
} from "rbrgs/lib/marsScoring";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { CounterButton, ToggleButton } from "./ScoreButtons";

type FormData = z.infer<typeof marsSchema>;

const COUNTERS = [
  { name: "panels", label: "Panels restored (Zone 1)" },
  { name: "speedBumps", label: "Speed-bumps crossed" },
  { name: "stairs", label: "Stairs crossed" },
  { name: "seeds", label: "Seeds planted" },
] as const;

const CATEGORIES = [
  { value: "BEGINNERS", label: "Principiantes" },
  { value: "ADVANCED", label: "Avanzados" },
] as const;

export const FormChallengeMars = () => {
  const form = useForm<FormData>({
    resolver: zodResolver(marsSchema),
    defaultValues: {
      category: "BEGINNERS",
      panels: 0,
      speedBumps: 0,
      stairs: 0,
      seeds: 0,
      seesawCrossed: false,
      genericFormSchema: { obtainedBonus: false, roundTimeSeconds: 0 },
    },
  });

  const values = form.watch();
  const limits = MARS_LIMITS[values.category];
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

  // Switching category lowers the caps, so clamp counts that would exceed them.
  function setCategory(category: FormData["category"]) {
    form.setValue("category", category);
    for (const { name } of COUNTERS) {
      form.setValue(name, Math.min(Number(values[name]), MARS_LIMITS[category][name]));
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => createEvaluation.mutate(data))}
        className="w-full space-y-4 text-white"
      >
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={values.category === c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                "min-h-14 rounded-lg border-2 font-medium transition active:scale-[0.98]",
                values.category === c.value
                  ? "border-white bg-white text-black"
                  : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {COUNTERS.filter(({ name }) => limits[name] > 0).map(
            ({ name, label }) => (
              <CounterButton
                key={name}
                label={label}
                count={Number(values[name])}
                max={limits[name]}
                points={MARS_POINTS[name]}
                onChange={(count) => form.setValue(name, count)}
              />
            ),
          )}
        </div>
        <ToggleButton
          label="Crossed the seesaw (sube y baja)"
          points={MARS_POINTS.seesaw}
          checked={values.seesawCrossed}
          onChange={(checked) => form.setValue("seesawCrossed", checked)}
        />

        <p className="text-right text-lg">
          Points: <span className="font-digital text-3xl">{preview}</span>
        </p>

        <FormField
          control={form.control}
          name="genericFormSchema.roundTimeSeconds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Round Time</FormLabel>
              <FormDescription>
                In seconds, competition time only (max {MARS_ROUND_SECONDS}).
                Time left is +1 pt/sec only with a perfect score.
              </FormDescription>
              <FormControl>
                <Input type="number" min={0} max={MARS_ROUND_SECONDS} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="genericFormSchema.lackOfProgress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lack of Progress</FormLabel>
              <FormDescription>
                Input -1 if the team didn&apos;t attempt the round.
              </FormDescription>
              <FormControl>
                <Input type="number" min={-1} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="genericFormSchema.teamId"
          render={() => (
            <FormItem>
              <FormLabel>Team</FormLabel>
              <FormControl>
                <Select
                  isLoading={isLoading}
                  isClearable
                  isSearchable
                  placeholder="Elegir un equipo"
                  onChange={(option) =>
                    form.setValue("genericFormSchema.teamId", option?.value ?? "")
                  }
                  options={teamIds?.map((t) => ({ value: t.id, label: t.name })) ?? []}
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
          <Button type="submit">Submit</Button>
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
