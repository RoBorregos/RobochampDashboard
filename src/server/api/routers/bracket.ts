import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "rbrgs/server/api/trpc";
import { Prisma, BracketCategory } from "@prisma/client";

// groups: team names per group (frozen on first save); picks: match id -> winner.
const bracketDataSchema = z.object({
  groups: z.array(z.array(z.string())),
  picks: z.record(z.string()),
});

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

  saveBracket: adminProcedure
    .input(
      z.object({
        category: z.nativeEnum(BracketCategory),
        payload: bracketDataSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Prisma expects InputJsonValue, so we cast the validated payload
      const payload = input.payload as Prisma.InputJsonValue;

      await ctx.db.bracket.upsert({
        where: { category: input.category },
        create: { category: input.category, data: payload },
        update: { data: payload },
      });
      return { ok: true };
    }),
});
