import { createTRPCRouter, protectedProcedure } from "rbrgs/server/api/trpc";

export const authRouter = createTRPCRouter({
  getSession: protectedProcedure.query(({ ctx }) => ctx.session),
});
