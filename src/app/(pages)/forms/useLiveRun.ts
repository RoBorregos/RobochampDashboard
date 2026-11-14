"use client";

import { useEffect } from "react";
import { createClient, REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from "@supabase/supabase-js";
import { env } from "~/env";
import { api } from "~/trpc/react";
import { LIVE_CHANNEL } from "~/lib/liveRun";

const supabase =
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

// One channel for the whole page; a ping of null means "(re)connected, refetch everything".
const listeners = new Set<(key: string | null) => void>();
let channel: RealtimeChannel | null = null;
function listen(fn: (key: string | null) => void) {
  if (supabase && !channel)
    channel = supabase
      .channel(LIVE_CHANNEL)
      .on("broadcast", { event: "ping" }, ({ payload }: { payload?: { key?: string } }) =>
        listeners.forEach((l) => l(payload?.key ?? null)),
      )
      .subscribe((status) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) listeners.forEach((l) => l(null));
      });
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/**
 * Live state of a run. The server pings Supabase Realtime after every write and
 * this refetches from our server: the ping carries no state, so anyone holding
 * the public anon key can't push fake scores onto a judge's screen.
 * Without Realtime configured it polls instead.
 */
export function useLiveRun(key: string | null) {
  const utils = api.useUtils();
  const query = api.judge.live.useQuery(
    { key: key ?? "" },
    { enabled: !!key, refetchInterval: supabase ? 30_000 : 500 },
  );
  useEffect(() => {
    if (!key) return;
    return listen((k) => {
      if (k === null || k === key) void utils.judge.live.invalidate({ key });
    });
  }, [key, utils]);
  return query;
}
