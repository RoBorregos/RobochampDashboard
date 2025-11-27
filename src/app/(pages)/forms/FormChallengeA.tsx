"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Control, useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";

import { toast } from "sonner";
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
import { Checkbox } from "rbrgs/app/_components/shadcn/ui/checkbox";
import { challengeASchema } from "rbrgs/lib/schemas";
import { Input } from "rbrgs/app/_components/shadcn/ui/input";
import Select from "react-select";

import { api } from "~/trpc/react";

type FormData = z.infer<typeof challengeASchema>;
export type FormControlA = Control<FormData>;

export const FormChallengeA = () => {
  const form = useForm<FormData>({
    resolver: zodResolver(challengeASchema),
    defaultValues: {
      finishedTrack: false,
      redCubes: 0,
      greenCubes: 0,
      blueCubes: 0,
      yellowCubes: 0,
      seesawCrossings: 0,
      cablesCut: 0,
      incorrectCut: false,
      genericFormSchema: {
        obtainedBonus: false,
        roundTimeSeconds: 0,
      },
    },
  });

  const { data: teamIds, isLoading } = api.team.getTeamIds.useQuery();

  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  const deleteEvaluation = api.judge.roundADelete.useMutation({
    onSuccess() {
      toast("Se ha borrado la evaluación.");
    },
    onError(error) {
      toast("Hubo un error al borrar la evaluación, checar consola.");
      console.error(error);
    },
  });

  const createEvaluation = api.judge.roundA.useMutation({
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

  const processedTeamIds = teamIds?.map((team) => ({
    value: team.id,
    label: team.name,
  }));

  function onSubmit(data: FormData) {
    const cubesInDeposit =
      (data.redCubes ?? 0) +
      (data.greenCubes ?? 0) +
      (data.blueCubes ?? 0) +
      (data.yellowCubes ?? 0);

    if ((data.cablesCut ?? 0) > 0 && cubesInDeposit < 4) {
      toast(
        "No se puede calificar la Zona B antes de completar la Zona A (mínimo 4 cubos en depósito).",
      );
      return;
    }

    createEvaluation.mutate(data);
    toast("Se ha enviado la evaluación!", {
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4 text-white">
          {JSON.stringify(data, null, 2)}
        </pre>
      ),
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full space-y-4 text-white"
      >
        <FormField
          control={form.control}
          name="finishedTrack"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Finished Track</FormLabel>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="ml-3"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="redCubes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Red cubes in deposit</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="greenCubes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Green cubes in deposit</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="blueCubes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Blue cubes in deposit</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="yellowCubes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Yellow cubes in deposit</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={1} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="seesawCrossings"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Seesaw crossings</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={1} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Zone B scoring inputs */}
        <FormField
          control={form.control}
          name="cablesCut"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cables cut (0-4)</FormLabel>
              <FormControl>
                <Input type="number" min={0} max={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="incorrectCut"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Incorrect cable cut (ended round)</FormLabel>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="ml-3"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="genericFormSchema.obtainedBonus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Obtained Bonus</FormLabel>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="ml-3"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="genericFormSchema.roundTimeSeconds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Round Time</FormLabel>
              <FormDescription>
                In seconds and without counting calibration time.
              </FormDescription>
              <FormControl>
                <Input type="number" min={0} max={300} {...field} />
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
                  className="basic-single"
                  classNamePrefix="select"
                  defaultValue={{ value: "", label: "Elegir un equipo" }}
                  isLoading={isLoading}
                  isClearable={true}
                  isSearchable={true}
                  onChange={(option) => {
                    form.setValue(
                      "genericFormSchema.teamId",
                      option?.value ?? "",
                    );
                  }}
                  options={processedTeamIds ?? []}
                  styles={{
                    control: (provided) => ({
                      ...provided,
                      backgroundColor: "black",
                      color: "white",
                      cursor: "pointer",
                    }),
                    menu: (provided) => ({
                      ...provided,
                      backgroundColor: "black",
                    }),
                    option: (provided, state) => ({
                      ...provided,
                      backgroundColor: state.isFocused ? "#333" : "black",
                      color: "white",
                      cursor: "pointer",
                    }),
                    singleValue: (provided) => ({
                      ...provided,
                      color: "white",
                    }),
                    placeholder: (provided) => ({
                      ...provided,
                      color: "white",
                    }),
                    input: (provided) => ({
                      ...provided,
                      color: "white",
                    }),
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
              onClick={() => {
                deleteEvaluation.mutate({ id: lastCreatedId }, {
                  onSuccess() {
                    toast('Se deshizo el último resultado.');
                    setLastCreatedId(null);
                  },
                });
              }}
            >
              Undo last
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
};
