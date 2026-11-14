"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "~/trpc/react";
import LogoLoader from "~/app/_components/logo-loader";

const STATUS = {
  ON_TIME: { label: "ON TIME", cls: "text-green-400" },
  DELAYED: { label: "DELAYED", cls: "text-red-500" },
  IN_PREPARATION: { label: "IN PREPARATION", cls: "text-amber-300" },
  IN_CALIBRATION: { label: "IN CALIBRATION", cls: "text-sky-300" },
  IN_ROUND: { label: "IN ROUND", cls: "text-green-300 animate-pulse" },
  FINALIZED: { label: "FINALIZED", cls: "text-blue-400" },
  CANCELLED: { label: "CANCELLED", cls: "text-red-500 line-through" },
} as const;
type Status = keyof typeof STATUS;

const hhmm = (d: Date | string | number) =>
  new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const VISIBLE_ROWS = 10;
const NAV_PX = 64; // navbar
const TOP_PX = 73; // schedule title/controls bar
// Row height is derived so exactly VISIBLE_ROWS fill the window under the bars (no page scroll, no dead space).
const rowFor = (vh: number) =>
  Math.max(32, Math.min(64, Math.floor((vh - NAV_PX - TOP_PX - 36) / VISIBLE_ROWS)));
const HEAD_PX = 36;
const OVERSCAN = 10; // extra rows rendered above/below the window
const STAR_KEY = "schedule-starred-teams";
const COLS = "grid grid-cols-[3.5rem_4rem_1fr_3rem_11rem_4rem_2rem] items-center gap-x-4 px-3";

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
  const s = String(n).padStart(4, "0");
  const lead = /^0*/.exec(s)?.[0] ?? "";
  return (
    <span className="block select-none pr-2 text-right font-normal tabular-nums">
      <span className="text-gray-700">{lead}</span>
      <span className="text-gray-300">{s.slice(lead.length)}</span>
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

  const listRef = useRef<HTMLDivElement>(null);
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

  // "Now" = every run in round; if none, the first run not over yet.
  const liveIds = useMemo(() => {
    const inRound = all.filter((r) => r.status === "IN_ROUND");
    if (inRound.length) return inRound.map((r) => r.id);
    const next = all.find((r) => r.status !== "FINALIZED" && r.status !== "CANCELLED");
    return next ? [next.id] : [];
  }, [all]);
  const live = useMemo(() => new Set(liveIds), [liveIds]);
  const focusKey = liveIds.join();
  const filtering = q.trim() !== "" || onlyStarred;
  const userMoved = useRef(false);
  // Index of the first row at the top of the viewport; only changes when a row boundary is crossed.
  const [topRow, setTopRow] = useState(0);
  // Fixed per window size, so scroll position <-> row index stays plain arithmetic.
  const [rowPx, setRowPx] = useState(44);
  useEffect(() => {
    const fit = () => setRowPx(rowFor(window.innerHeight));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const center = (smooth: boolean) => {
    const box = listRef.current;
    // Rows are windowed (not all in the DOM), so position comes from index math.
    const a = all.findIndex((r) => r.id === liveIds[0]);
    if (!box || a < 0) return;
    // Top of the view = the one finalized row just before the live runs (always a whole row).
    const maxRow = Math.max(0, all.length - VISIBLE_ROWS);
    box.scrollTo({
      top: Math.min(Math.max(a - 1, 0), maxRow) * rowPx,
      behavior: smooth ? "smooth" : "auto",
    });
  };

  // Rows must never rest half-cut: once scrolling pauses, settle on the nearest whole row.
  const snapTimer = useRef<number>();
  const settle = () => {
    window.clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => {
      const box = listRef.current;
      if (!box) return;
      const top = Math.round(box.scrollTop / rowPx) * rowPx;
      if (Math.abs(top - box.scrollTop) > 0.5) box.scrollTo({ top, behavior: "smooth" });
    }, 120);
  };

  // Filter changes (and first load): top of results, or centered on now when unfiltered.
  useEffect(() => {
    userMoved.current = false;
    if (filtering) listRef.current?.scrollTo({ top: 0 });
    else center(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, onlyStarred, isLoading, rowPx]);

  // Who's in round changed: follow it, unless the user has scrolled away on their own.
  useEffect(() => {
    if (!userMoved.current && !filtering) center(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  if (isLoading) return <LogoLoader />;

  // Only the rows in (or near) view are mounted: ~16 of N.
  const start = Math.max(0, Math.min(topRow, rows.length) - OVERSCAN);
  const end = Math.min(rows.length, topRow + VISIBLE_ROWS + 1 + OVERSCAN);

  const btn =
    "rounded border border-gray-700 px-3 py-1 text-sm text-[#dfdfdf] hover:border-roboblue hover:text-roboblue";

  return (
    // Whole page is exactly one window tall: the list's scrollbar is the only one, like everyuuid.com.
    <div className="box-border h-[100dvh] overflow-hidden bg-black pt-[4rem] text-[#dfdfdf]">
    <div>
      <div className="border-b border-roboblue px-4 py-2">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-jersey_25 text-3xl leading-none text-roboblue md:text-4xl">
              Schedule
            </h1>
            <p className="font-sans text-xs text-gray-400">
              Scroll till you find your team
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-sans">
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
            {liveIds.length > 0 && (
              <button
                onClick={() => {
                  setQ("");
                  setOnlyStarred(false);
                  userMoved.current = false;
                  center(true);
                }}
                className={btn}
              >
                now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* wrapper is content-width so the scrollbar sits right next to the table */}
      <div className="relative mx-auto max-w-7xl px-4">
      <div
        ref={listRef}
        onWheel={() => (userMoved.current = true)}
        onTouchStart={() => (userMoved.current = true)}
        onPointerDown={() => (userMoved.current = true)}
        onScroll={(e) => {
          setTopRow(Math.floor(e.currentTarget.scrollTop / rowPx));
          settle();
        }}
        style={{ maxHeight: HEAD_PX + VISIBLE_ROWS * rowPx }}
        // snap-y mandatory + scroll-padding = header height: wheel/trackpad/keys always land on whole rows
        className="snap-y snap-mandatory overflow-auto overscroll-contain [scroll-padding-top:36px] [overflow-anchor:none] [scrollbar-color:#0A38EF_#1f2937] [scrollbar-width:auto] [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-roboblue [&::-webkit-scrollbar-track]:bg-gray-800"
      >
        <div className="min-w-[44rem] font-sans text-sm font-bold md:text-base">
          <div
            className={`${COLS} sticky top-0 z-10 h-9 border-b border-gray-700 bg-black text-xs tracking-widest text-gray-500`}
          >
            <span className="pr-2 text-right">#</span>
            <span>TIME</span>
            <span>TEAM</span>
            <span>TRK</span>
            <span>STATUS</span>
            <span className="text-right">PTS</span>
            <span />
          </div>

          {/* spacers stand in for the rows that aren't rendered, keeping scrollbar size/position true */}
          <div style={{ height: start * rowPx }} />
          {rows.slice(start, end).map((r, k) => {
            const i = start + k;
            const s = STATUS[r.status as Status];
            const starred = stars.has(r.team);
            return (
              <div
                key={r.id}
                style={{ height: rowPx }}
                className={`${COLS} snap-start border-b border-gray-800 transition-all hover:bg-gray-900 ${
                  live.has(r.id) ? "bg-roboblue/10 shadow-[inset_3px_0_0_0_#0A38EF]" : ""
                }`}
              >
                <Index n={i + 1} />
                <span className="tabular-nums text-[#dfdfdf]">{hhmm(r.time)}</span>
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
          <div style={{ height: (rows.length - end) * rowPx }} />

          {rows.length === 0 && (
            <p className="py-16 text-center text-gray-500">
              {all.length === 0 ? "NO RUNS SCHEDULED — CHECK BACK SOON" : "NO MATCHES"}
            </p>
          )}
        </div>
      </div>
      </div>

    </div>
    </div>
  );
}
