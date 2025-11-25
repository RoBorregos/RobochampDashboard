import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "rbrgs/server/api/trpc";

export const bracketRouter = createTRPCRouter({
  getBracket: publicProcedure
    .input(z.object({ category: z.enum(["beginners", "advanced"]) }))
    .query(async ({ ctx, input }) => {
      const category = input.category === "beginners" ? "BEGINNERS" : "ADVANCED";

      const record = await ctx.db.bracket.findUnique({
        where: { category: category as any },
        select: { data: true },
      });

      return record?.data ?? null;
    }),

  saveBracket: publicProcedure
    .input(
      z.object({
        category: z.enum(["beginners", "advanced"]),
        payload: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const category = input.category === "beginners" ? "BEGINNERS" : "ADVANCED";

      await ctx.db.bracket.upsert({
        where: { category: category as any },
        create: { category: category as any, data: input.payload as any },
        update: { data: input.payload as any },
      });
      return { ok: true };
    }),
});
