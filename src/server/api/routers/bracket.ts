import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, adminProcedure } from "rbrgs/server/api/trpc";
import { Prisma, BracketCategory } from "@prisma/client";
import { syncSchedule } from "rbrgs/lib/bracketSchedule";
import { invalidateSchedule } from "./schedule";

// groups: team names per group (frozen on first save); picks: match id -> winner.
const bracketDataSchema = z.object({
  groups: z.array(z.array(z.string())),
  picks: z.record(z.string()),
});
// Semifinal/final kick-off times "HH:MM" (event time), keyed s0, s1, f; stored beside the groups.
const KNOCKOUT_KEYS = ["s0", "s1", "f"] as const;

export const bracketRouter = createTRPCRouter({
  // Team names per category, from seleccion2026.csv (see prisma/seed-selection.ts).
  getTeams: publicProcedure
    .input(z.object({ category: z.nativeEnum(BracketCategory) }))
    .query(async ({ ctx, input }) => {
      const teams = await ctx.db.team.findMany({
        where: { category: input.category },
        select: { name: true },
        orderBy: { name: "asc" },
      });
      return teams.map((t) => t.name);
    }),

  getBracket: publicProcedure
    .input(z.object({ category: z.nativeEnum(BracketCategory) }))
    .query(async ({ ctx, input }) => {
      const record = await ctx.db.bracket.findUnique({
        where: { category: input.category },
        select: { data: true },
      });

      return record?.data ?? null;
    }),

  setKnockoutTimes: adminProcedure
    .input(
      z.object({
        category: z.nativeEnum(BracketCategory),
        times: z.record(z.enum(KNOCKOUT_KEYS), z.string().regex(/^\d{2}:\d{2}$/)),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const old = await ctx.db.bracket.findUnique({ where: { category: input.category } });
      if (!old) throw new TRPCError({ code: "BAD_REQUEST", message: "Save the bracket first" });
      const data = { ...(old.data as object), times: input.times } as Prisma.InputJsonValue;
      await ctx.db.bracket.update({ where: { category: input.category }, data: { data } });
      return { ok: true };
    }),

  saveBracket: adminProcedure
    .input(
      z.object({
        category: z.nativeEnum(BracketCategory),
        payload: bracketDataSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Prisma expects InputJsonValue, so we cast the validated payload
      // Keep the knockout times, which the bracket editor doesn't send.
      const old = await ctx.db.bracket.findUnique({ where: { category: input.category }, select: { data: true } });
      const times = (old?.data as { times?: unknown } | null)?.times ?? {};
      const payload = { ...input.payload, times } as Prisma.InputJsonValue;

      await ctx.db.bracket.upsert({
        where: { category: input.category },
        create: { category: input.category, data: payload },
        update: { data: payload },
      });
      // The schedule is derived from the groups, so it follows every bracket save.
      const sync = await syncSchedule(ctx.db, input.category, input.payload.groups);
      invalidateSchedule();
      return { ok: true, ...sync };
    }),
});
