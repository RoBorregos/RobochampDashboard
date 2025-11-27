import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "rbrgs/server/api/trpc";
import { Prisma, BracketCategory } from "@prisma/client";

// Schemas
const matchSchema = z.object({
  id: z.string(),
  team1: z.string().optional(),
  team2: z.string().optional(),
  team3: z.string().optional(),
  winner: z.string().optional(),
});

const roundSchema = z.object({
  name: z.string(),
  matches: z.array(matchSchema),
});

const advancedBracketDataSchema = z.object({
  rounds: z.array(roundSchema),
  final: matchSchema,
  thirdPlace: matchSchema.optional(),
  winner: z.string().optional(),
});

const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  teams: z.array(z.string()),
  qualified: z.array(z.string()),
  finalMatch: matchSchema,
});

const beginnersBracketDataSchema = z.object({
  groups: z.array(groupSchema),
  semifinalists: z.array(z.string()),
  final: matchSchema,
  thirdPlaceTeam: z.string(),
});

export const bracketRouter = createTRPCRouter({
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
      z.discriminatedUnion("category", [
        z.object({
          category: z.literal(BracketCategory.BEGINNERS),
          payload: beginnersBracketDataSchema,
        }),
        z.object({
          category: z.literal(BracketCategory.ADVANCED),
          payload: advancedBracketDataSchema,
        }),
      ])
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
