import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// In-memory storage for brackets (resets on server restart)
const bracketsStore: Record<string, unknown> = {};

export const bracketRouter = createTRPCRouter({
  getBracket: publicProcedure
    .input(z.object({ category: z.enum(["beginners", "advanced"]) }))
    .query(({ input }) => {
      return bracketsStore[input.category] ?? null;
    }),

  saveBracket: publicProcedure
    .input(
      z.object({
        category: z.enum(["beginners", "advanced"]),
        payload: z.any(),
      })
    )
    .mutation(({ input }) => {
      bracketsStore[input.category] = input.payload;
      return { ok: true };
    }),
});
