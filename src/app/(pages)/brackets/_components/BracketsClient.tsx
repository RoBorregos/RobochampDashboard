"use client";

import { BracketCategory, Role } from "@prisma/client";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import LogoLoader from "~/app/_components/logo-loader";
import Header from "~/app/_components/header";

// Groups of at most 5 teams; each group winner goes to the semi-finals, paired in order.
const MAX_GROUP = 5;

type Data = { groups: string[][]; picks: Record<string, string> };
type Slot = {
  name?: string;
  won?: boolean;
  onClick?: () => void;
  // Admin drag-and-drop: drag a team onto another to swap them (key = "group:index").
  dragKey?: string;
  onSwap?: (fromKey: string) => void;
};

// Seeded shuffle: groups look random but are the same for every viewer and reload.
function makeGroups(names: string[], random = false): string[][] {
  const out = [...names].sort();
  let seed = [...out.join("|")].reduce(
    (h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0,
    7,
  );
  const seeded = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rand = random ? Math.random : seeded;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  // Balanced sizes (4 or 5).
  const count = Math.ceil(out.length / MAX_GROUP);
  const groups: string[][] = [];
  for (let g = 0, from = 0; g < count; g++) {
    const size =
      Math.floor(out.length / count) + (g < out.length % count ? 1 : 0);
    groups.push(out.slice(from, (from += size)));
  }
  return groups;
}

// Derives every stage from the picks, dropping picks whose team is no longer in that match.
function resolve({ groups, picks }: Data) {
  const valid: Record<string, string> = {};
  const pick = (id: string, teams: (string | undefined)[]) => {
    const w = picks[id];
    if (w && teams.includes(w)) valid[id] = w;
    return valid[id];
  };
  const groupWinners = groups.map((g, i) => pick(`g${i}`, g));
  const semis = Array.from({ length: Math.ceil(groups.length / 2) }, (_, k) => {
    const teams = [groupWinners[2 * k], groupWinners[2 * k + 1]];
    return { teams, winner: pick(`s${k}`, teams) };
  });
  const finalTeams = semis.map((s) => s.winner);
  const champion = pick("f", finalTeams);
  return { groupWinners, semis, finalTeams, champion, picks: valid };
}

// Google-style match card: stacked team rows, winner highlighted, losers dimmed.
function MatchCard({
  slots,
  label,
  accent,
  scores,
}: {
  slots: Slot[];
  label?: string;
  accent?: boolean;
  scores: Record<string, number>;
}) {
  const decided = slots.some((s) => s.won);
  return (
    <div className="w-full">
      {(!!label || decided) && (
        <div className="mb-1 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <span>{label}</span>
          {decided && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">
              FT
            </span>
          )}
        </div>
      )}
      <div
        className={`overflow-hidden rounded-xl border bg-[#141414] ${accent ? "border-blue-500/60" : "border-white/10"}`}
      >
        {slots.map((s, i) => {
          const clickable = !!s.onClick && !!s.name;
          return (
            <div
              key={`${s.name ?? "empty"}-${i}`}
              draggable={!!s.dragKey}
              onDragStart={(e) =>
                e.dataTransfer.setData("text/plain", s.dragKey!)
              }
              onDragOver={(e) => s.onSwap && e.preventDefault()}
              onDrop={(e) => s.onSwap?.(e.dataTransfer.getData("text/plain"))}
            >
              <button
                type="button"
                disabled={!clickable}
                onClick={clickable ? s.onClick : undefined}
                className={`flex h-9 w-full items-center justify-between gap-2 border-l-4 px-3 text-left text-sm ${i > 0 ? "border-t border-t-white/5" : ""} ${
                  s.won
                    ? "border-l-blue-500 bg-blue-600/20 font-bold text-white"
                    : `border-l-transparent ${decided ? "text-slate-500" : "text-slate-300"}`
                } ${clickable ? "cursor-pointer hover:bg-white/5" : "cursor-default"}`}
              >
                <span className="truncate">
                  {s.name ?? <span className="text-slate-600">—</span>}
                </span>
                {s.name && (
                  <span className="flex items-center gap-1 tabular-nums">
                    {scores[s.name] ?? 0}
                    <span
                      className={`w-2 text-xs text-white ${s.won ? "" : "invisible"}`}
                    >
                      ◂
                    </span>
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One round column: title on top, equal-height rows so cards line up with the connectors.
function RoundColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-52 shrink-0 snap-start flex-col sm:w-56">
      <h3 className="flex h-8 items-center justify-center text-[11px] font-bold uppercase tracking-widest text-blue-400">
        {title}
      </h3>
      <div className="grid flex-1 items-center" style={{ gridAutoRows: "1fr" }}>
        {children}
      </div>
    </div>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="relative flex items-center py-2">{children}</div>
);

// Elbow connectors from `from` evenly spaced rows to `to` evenly spaced rows.
function Links({ from, to }: { from: number; to: number }) {
  const y = (i: number, n: number) => ((i + 0.5) / n) * 100;
  const d = Array.from({ length: from }, (_, i) => {
    const t = Math.min(to - 1, Math.floor((i * to) / from));
    return `M0 ${y(i, from)}H12V${y(t, to)}H24`;
  }).join("");
  return (
    <div className="flex w-6 shrink-0 flex-col sm:w-10">
      <div className="h-8" />
      <svg
        className="min-h-0 w-full flex-1"
        viewBox="0 0 24 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={d}
          fill="none"
          stroke="#3b82f6"
          strokeOpacity={0.45}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

// Horizontally swipeable on phones (snaps per round); centered on desktop.
function BracketScroller({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-7xl snap-x snap-mandatory overflow-x-auto px-4 pb-8 [scrollbar-width:thin]">
      <div className="mx-auto flex w-max">{children}</div>
    </div>
  );
}

function CategoryBracket({
  data,
  scores,
  onPick,
  onSwap,
}: {
  data: Data;
  scores: Record<string, number>;
  onPick?: (id: string, team: string) => void;
  onSwap?: (a: string, b: string) => void;
}) {
  const r = resolve(data);
  const slot = (id: string, team: string | undefined): Slot => ({
    name: team,
    won: !!team && r.picks[id] === team,
    onClick: onPick && team ? () => onPick(id, team) : undefined,
  });
  const g = data.groups.length;
  const s = r.semis.length;

  return (
    <BracketScroller>
      <RoundColumn title="Grupos">
        {data.groups.map((teams, i) => (
          <Row key={i}>
            <MatchCard
              scores={scores}
              label={`Grupo ${String.fromCharCode(65 + i)}`}
              slots={teams.map((t, j) => ({
                ...slot(`g${i}`, t),
                dragKey: onSwap ? `${i}:${j}` : undefined,
                onSwap: onSwap
                  ? (from) => onSwap(from, `${i}:${j}`)
                  : undefined,
              }))}
            />
          </Row>
        ))}
      </RoundColumn>
      <Links from={g} to={s} />
      <RoundColumn title="Semifinales">
        {r.semis.map((m, k) => (
          <Row key={k}>
            <MatchCard
              accent
              scores={scores}
              label={`Semifinal ${k + 1}`}
              slots={m.teams.map((t) => slot(`s${k}`, t))}
            />
          </Row>
        ))}
      </RoundColumn>
      <Links from={s} to={1} />
      <RoundColumn title="Final">
        <Row>
          <MatchCard
            accent
            scores={scores}
            slots={r.finalTeams.map((t) => slot("f", t))}
          />
        </Row>
      </RoundColumn>
      <Links from={1} to={1} />
      <RoundColumn title="Campeón">
        <Row>
          <MatchCard
            accent
            scores={scores}
            slots={[{ name: r.champion, won: !!r.champion }]}
          />
        </Row>
      </RoundColumn>
    </BracketScroller>
  );
}

export default function BracketsClient({ userRole }: { userRole?: Role }) {
  const [category, setCategory] = useState<BracketCategory>(
    BracketCategory.BEGINNERS,
  );
  const isAdmin = userRole === Role.ADMIN;
  const utils = api.useUtils();

  const { data: scoreboard } = api.scoreboard.getScoreboard.useQuery();
  const { data: teams } = api.bracket.getTeams.useQuery({ category });
  const { data: saved } = api.bracket.getBracket.useQuery({ category });
  // Unconfirmed admin edits per category; nothing is saved until "Confirmar".
  const [drafts, setDrafts] = useState<Partial<Record<BracketCategory, Data>>>(
    {},
  );
  const draft = drafts[category];
  const clearDraft = () => setDrafts((d) => ({ ...d, [category]: undefined }));
  const save = api.bracket.saveBracket.useMutation({
    onSuccess: async () => {
      await utils.bracket.getBracket.invalidate({ category });
      clearDraft();
      toast.success("Bracket guardado");
    },
    onError: (e) => toast.error(`Error al guardar: ${e.message}`),
  });

  if (!scoreboard || !teams || saved === undefined) return <LogoLoader />;

  // Saved data in an older shape is ignored and rebuilt from the team list.
  const s = saved as Partial<Data> | null;
  const saved_: Data =
    s && Array.isArray(s.groups) && s.groups.every(Array.isArray) && s.picks
      ? (s as Data)
      : { groups: makeGroups(teams), picks: {} };
  const data = draft ?? saved_;
  const scores = Object.fromEntries(
    scoreboard.map((t) => [t.teamName, t.total]),
  );

  // Clicking the selected team again unselects it.
  const onPick = (id: string, team: string) => {
    const picks = { ...data.picks };
    if (picks[id] === team) delete picks[id];
    else picks[id] = team;
    setDrafts((d) => ({
      ...d,
      [category]: {
        groups: data.groups,
        picks: resolve({ ...data, picks }).picks,
      },
    }));
  };

  const setData = (next: Data) =>
    setDrafts((d) => ({ ...d, [category]: next }));

  const onSwap = (a: string, b: string) => {
    const groups = data.groups.map((g) => [...g]);
    const [ai, aj, bi, bj] = [...a.split(":"), ...b.split(":")].map(Number);
    const x = groups[ai!]?.[aj!];
    const y = groups[bi!]?.[bj!];
    if (x === undefined || y === undefined) return;
    groups[ai!]![aj!] = y;
    groups[bi!]![bj!] = x;
    setData({ groups, picks: resolve({ groups, picks: data.picks }).picks });
  };

  return (
    <div className="flex min-h-screen flex-col items-center overflow-auto bg-[#0a0a0a] p-4 pt-24 text-white md:p-8 md:pt-32">
      <div className="z-10 mb-8 flex w-full max-w-5xl flex-col items-center">
        <Header title="ROBOCHAMP" subtitle={category.toUpperCase()} />
        {/* relative z-20: the -mt-10 overlap put the positioned Header above these buttons on mobile */}
        <div className="relative z-20 -mt-10 flex rounded-full border border-white/10 bg-[#1a1a1a] p-1.5">
          {[BracketCategory.BEGINNERS, BracketCategory.ADVANCED].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 md:px-8 md:py-3 md:text-sm ${category === cat ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-500 hover:bg-white/5 hover:text-white"} `}
            >
              {cat}
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Grupos de 4 o 5 equipos · el ganador de cada grupo pasa a semifinales
          {isAdmin &&
            " · toca un equipo para marcarlo ganador · arrastra un equipo sobre otro para intercambiarlos"}
        </p>
      </div>
      {isAdmin && (
        <button
          onClick={() =>
            setData({ groups: makeGroups(teams, true), picks: {} })
          }
          className="mb-4 rounded-full border border-blue-500 bg-[#1a1a1a] px-6 py-2 text-xs font-bold uppercase tracking-wider text-blue-400 transition-all hover:bg-blue-600 hover:text-white"
        >
          Aleatorizar grupos
        </button>
      )}
      {isAdmin && draft && (
        <div className="mb-4 flex gap-3">
          <button
            disabled={save.isPending}
            onClick={() => save.mutate({ category, payload: draft })}
            className="rounded-full border border-green-500 bg-[#1a1a1a] px-6 py-2 text-xs font-bold uppercase tracking-wider text-green-400 transition-all hover:bg-green-600 hover:text-white disabled:cursor-wait disabled:opacity-50"
          >
            {save.isPending ? "Guardando..." : "Confirmar cambios"}
          </button>
          <button
            disabled={save.isPending}
            onClick={clearDraft}
            className="rounded-full border border-white/10 px-6 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5"
          >
            Descartar
          </button>
        </div>
      )}
      <CategoryBracket
        key={category}
        data={data}
        scores={scores}
        onPick={isAdmin ? onPick : undefined}
        onSwap={isAdmin ? onSwap : undefined}
      />
    </div>
  );
}
