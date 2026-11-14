"use client";

import { FormChallengeMars } from "../forms/FormChallengeMars";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/_components/shadcn/ui/select";
import Header from "rbrgs/app/_components/header";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { judgeAssignment } from "~/lib/judgeRun";
import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";
import LogoLoader from "~/app/_components/logo-loader";
import { JudgeRuns } from "./JudgeRuns";
import { CALIBRATION_MS, formatClock } from "../forms/RunTimer";

export default function JudgePage() {
  const [selected, setSelected] = useState("Sin seleccionar");

  const session = useSession();
  const me = api.judge.me.useQuery();
  const lineup = api.judge.lineup.useQuery(undefined, { refetchInterval: 60_000 });
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Server-corrected clock, so a judge's wrong device time can't shift the schedule.
  const offset = lineup.data ? lineup.data.serverNow.getTime() - lineup.dataUpdatedAt : 0;
  const now = tick + offset;
  const { judgeColor, judgeTrack } = me.data ?? {};
  const auto =
    judgeTrack && lineup.data
      ? judgeAssignment(lineup.data.runs, judgeTrack, judgeColor ?? null, now)
      : null;

  if (session.status === "loading") return <LogoLoader />;

  if (
    session.data?.user?.role !== Role.ADMIN &&
    session.data?.user?.role !== Role.JUDGE
  ) {
    return (
      <main className="mt-[4rem] h-96 bg-black text-sm text-white md:text-base">
        <div className="md:pb-20">
          <Header title="Judge" subtitle="" />
        </div>
        <div className="p-2">
          <h1 className="mb-5 text-center text-4xl">
            You don&apos;t have permission to access this page.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="mt-[4rem] h-96 bg-black text-sm text-white md:text-base">
      <div className="md:pb-20">
        <Header title="Judge" subtitle="" />
      </div>
      <div className="p-2">
        <JudgeRuns />
        {auto ? (
          <AutoRun auto={auto} now={now} offset={offset} />
        ) : (<>
        <p className="mb-4 text-center text-neutral-400">
          Elige tu pista (y color) para seguir el horario automáticamente.
        </p>
        <h1 className="mb-5 text-center text-4xl">Seleccionar Reto</h1>
        <div className="mx-auto lg:w-1/2">
          <Select
            onValueChange={(value) => {
              setSelected(value);
            }}
            value={selected}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un reto" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="mars" className="cursor-pointer">
                Pista
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="">
          <ShowForm selection={selected} />
        </div></>)}
      </div>
    </main>
  );
}

const ShowForm = ({ selection }: { selection: string }) => {
  switch (selection) {
    case "mars":
      return (
        <ChallengeWrapper>
          <FormChallengeMars />
        </ChallengeWrapper>
      );
    default:
      return <></>;
  }
};

const ChallengeWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="m-8 mx-auto rounded border border-white p-3 shadow-lg lg:w-1/2">
      {children}
    </div>
  );
};

// Follows the schedule: the form is the judge's current run (by colour) and
// finalizes itself when the next run on the track starts.
const AutoRun = ({
  auto,
  now,
  offset,
}: {
  auto: ReturnType<typeof judgeAssignment>;
  now: number;
  offset: number;
}) => {
  const { current, next, endsAt, nextEndsAt, other, otherEndsAt } = auto;
  const [dontCare, setDontCare] = useState<string | null>(null);
  // When time's up the next run takes over right away (its negative "starts in"
  // countdown / calibration shows). The finished form stays one extra tick so its
  // auto-finalize effect submits before it unmounts.
  const showCurrent = current && now < endsAt! + 1500;
  if (!showCurrent && other) {
    const key = `${other.teamId}:${other.round}`;
    if (dontCare === key)
      return (
        <ChallengeWrapper>
          <FormChallengeMars key={key} run={other} now={now} endsAt={otherEndsAt!} offset={offset} next={next} />
        </ChallengeWrapper>
      );
    return <Observer run={other} now={now} endsAt={otherEndsAt!} onDontCare={() => setDontCare(key)} />;
  }
  const run = showCurrent ? current : next;
  if (!run) return <p className="my-8 text-center text-xl">Sin corridas asignadas.</p>;
  return (
    <ChallengeWrapper>
      <FormChallengeMars
        key={`${run.teamId}:${run.round}`}
        run={run}
        now={now}
        endsAt={showCurrent ? endsAt! : nextEndsAt!}
        offset={offset}
        next={showCurrent ? next : auto.after}
      />
    </ChallengeWrapper>
  );
};

// The other colour's run: a cooldown while its judge calibrates, then the same run time
// every judge sees. "Don't care" lets this judge evaluate it anyway (e.g. a mix-up).
const Observer = ({
  run,
  now,
  endsAt,
  onDontCare,
}: {
  run: NonNullable<ReturnType<typeof judgeAssignment>["other"]>;
  now: number;
  endsAt: number;
  onDontCare: () => void;
}) => {
  const calEnd = run.start.getTime() + CALIBRATION_MS;
  const cal = now < calEnd;
  return (
    <ChallengeWrapper>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-neutral-400">
          Pista {run.track} · Round {run.round} · other colour
        </p>
        <p className="truncate text-2xl font-bold">{run.teamName}</p>
        <p className={`mt-3 text-xs uppercase tracking-widest ${cal ? "text-sky-400" : "text-neutral-400"}`}>
          {cal ? "Cooldown · other judge calibrating" : "Run time"}
        </p>
        <p className={`font-digital text-6xl tabular-nums ${cal ? "text-sky-400" : "text-neutral-300"}`}>
          {cal && "-"}
          {formatClock(cal ? calEnd - now : Math.min(now, endsAt) - calEnd)}
        </p>
        {!cal && (
          <button
            type="button"
            onClick={onDontCare}
            className="mt-3 h-12 w-full rounded-lg border-2 border-amber-400 bg-amber-400/20 text-sm font-semibold"
          >
            Don&apos;t care
          </button>
        )}
      </div>
    </ChallengeWrapper>
  );
};
