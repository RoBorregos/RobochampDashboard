"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import Footer from "~/app/_components/footer";
import LogoLoader from "~/app/_components/logo-loader";

const STATUS = {
  ON_TIME: { label: "ON TIME", cls: "text-green-400" },
  DELAYED: { label: "DELAYED", cls: "text-red-500" },
  IN_PREPARATION: { label: "IN PREPARATION", cls: "text-amber-300" },
  IN_CALIBRATION: { label: "IN CALIBRATION", cls: "text-sky-300" },
  IN_ROUND: { label: "IN ROUND", cls: "text-green-300 animate-pulse" },
  FINALIZED: { label: "FINALIZED", cls: "text-gray-500" },
  CANCELLED: { label: "CANCELLED", cls: "text-red-500 line-through" },
} as const;
type Status = keyof typeof STATUS;

const hhmm = (d: Date | string | number) =>
  new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const STAR_KEY = "schedule-starred-teams";
const COLS = "grid grid-cols-[5.5rem_4rem_1fr_3rem_11rem_4rem_2rem] items-center gap-x-3";

// Own component so the 1s tick doesn't re-render the table.
function Clock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular-nums">
      {now === null ? "--:--:--" : new Date(now).toLocaleTimeString("en-GB")}
    </span>
  );
}

// Dim leading zeros, bright significant digits — the everyuuid index look.
function Index({ n }: { n: number }) {
  const s = String(n).padStart(6, "0");
  const lead = /^0*/.exec(s)?.[0] ?? "";
  return (
    <span className="select-none">
      <span className="text-gray-700">{lead}</span>
      <span className="text-gray-400">{s.slice(lead.length)}</span>
    </span>
  );
}

export default function SchedulePage() {
  const utils = api.useUtils();
  // Polling pauses in background tabs (react-query default); the server
  // answers from a 5s cache, so viewers don't multiply DB reads.
  const { data, isLoading } = api.schedule.board.useQuery(undefined, {
    refetchInterval: 10_000,
  });
  const setStatus = api.schedule.setStatus.useMutation({
    onSuccess: () => utils.schedule.board.invalidate(),
  });

  const [q, setQ] = useState("");
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [stars, setStars] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      setStars(new Set(JSON.parse(localStorage.getItem(STAR_KEY) ?? "[]") as string[]));
    } catch {}
  }, []);

  const toggleStar = (team: string) =>
    setStars((prev) => {
      const next = new Set(prev);
      if (!next.delete(team)) next.add(team);
      try {
        localStorage.setItem(STAR_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });

  const all = useMemo(() => data?.rows ?? [], [data]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (r) =>
        (!needle || r.team.toLowerCase().includes(needle)) &&
        (!onlyStarred || stars.has(r.team)),
    );
  }, [all, q, onlyStarred, stars]);

  // First run that isn't over yet = "now" on the board.
  const nextId = all.find((r) => r.status !== "FINALIZED" && r.status !== "CANCELLED")?.id;

  if (isLoading) return <LogoLoader />;

  const btn =
    "rounded border border-gray-700 px-3 py-1 text-sm text-white hover:border-roboblue hover:text-roboblue";

  return (
    <div className="mt-[4rem] min-h-screen bg-black text-white">
      {/* sticky one-line header, like everyuuid */}
      <div className="sticky top-[4rem] z-40 border-b border-roboblue bg-black/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-jersey_25 text-3xl leading-none text-roboblue md:text-4xl">
              Schedule
            </h1>
            <p className="font-mono text-xs text-gray-400">
              Scroll till you find your team
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono">
            <span className="mr-2 text-lg text-roboblue md:text-xl">
              <Clock />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="search team"
              className="w-36 rounded border border-gray-700 bg-black px-3 py-1 text-sm placeholder:text-gray-600 focus:border-roboblue focus:outline-none"
            />
            <button
              onClick={() => setOnlyStarred((v) => !v)}
              className={`${btn} ${onlyStarred ? "border-roboblue text-roboblue" : ""}`}
              aria-pressed={onlyStarred}
            >
              ★ starred
            </button>
            {nextId && (
              <button
                onClick={() =>
                  document
                    .getElementById(`run-${nextId}`)
                    ?.scrollIntoView({ block: "center", behavior: "smooth" })
                }
                className={btn}
              >
                now
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto px-4">
        <div className="mx-auto min-w-[44rem] max-w-7xl font-mono text-sm md:text-base">
          <div
            className={`${COLS} border-b border-gray-700 py-2 text-xs tracking-widest text-gray-500`}
          >
            <span>#</span>
            <span>TIME</span>
            <span>TEAM</span>
            <span>TRK</span>
            <span>STATUS</span>
            <span className="text-right">PTS</span>
            <span />
          </div>

          {rows.map((r, i) => {
            const s = STATUS[r.status as Status];
            const starred = stars.has(r.team);
            return (
              <div
                key={r.id}
                id={`run-${r.id}`}
                className={`${COLS} scroll-mt-40 border-b border-gray-800 py-1.5 transition-colors hover:bg-gray-900 ${
                  r.id === nextId ? "bg-roboblue/10 shadow-[inset_3px_0_0_0_#0A38EF]" : ""
                }`}
              >
                <Index n={i + 1} />
                <span className="text-white">{hhmm(r.time)}</span>
                <span className="truncate uppercase">{r.team}</span>
                <span className="text-roboblue">{r.track}</span>
                <span className={s.cls}>
                  {data?.canEdit ? (
                    <select
                      value={r.status}
                      disabled={setStatus.isPending}
                      onChange={(e) =>
                        setStatus.mutate({ id: r.id, status: e.target.value as Status })
                      }
                      className="w-full rounded border border-gray-700 bg-black text-inherit"
                    >
                      {Object.entries(STATUS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    s.label
                  )}
                </span>
                <span className="text-right tabular-nums">{r.points ?? "—"}</span>
                <button
                  onClick={() => toggleStar(r.team)}
                  aria-label={`${starred ? "Unstar" : "Star"} ${r.team}`}
                  aria-pressed={starred}
                  className={starred ? "text-amber-300" : "text-gray-600 hover:text-amber-300"}
                >
                  {starred ? "★" : "☆"}
                </button>
              </div>
            );
          })}

          {rows.length === 0 && (
            <p className="py-16 text-center text-gray-500">
              {all.length === 0 ? "NO RUNS SCHEDULED — CHECK BACK SOON" : "NO MATCHES"}
            </p>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
