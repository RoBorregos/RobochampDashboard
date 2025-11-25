import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "rbrgs/server/api/trpc";
import { Prisma } from "@prisma/client";

export const bracketRouter = createTRPCRouter({
  getBracket: publicProcedure
    .input(z.object({ category: z.enum(["beginners", "advanced"]) }))
    .query(async ({ ctx, input }) => {
      const category = input.category === "beginners" ? "BEGINNERS" : "ADVANCED";

      const record = await ctx.db.bracket.findUnique({
        where: { category: category },
        select: { data: true },
      });

      return record?.data ?? null;
    }),

  saveBracket: publicProcedure
    .input(
      z.object({
        category: z.enum(["beginners", "advanced"]),
        payload: z.unknown(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const category = input.category === "beginners" ? "BEGINNERS" : "ADVANCED";
      const payload =
        input.payload === null ? Prisma.JsonNull : (input.payload as Prisma.InputJsonValue);

      await ctx.db.bracket.upsert({
        where: { category: category },
        create: { category: category, data: payload },
        update: { data: payload },
      });
      return { ok: true };
    }),
});
