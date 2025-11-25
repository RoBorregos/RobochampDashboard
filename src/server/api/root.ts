import { createCallerFactory, createTRPCRouter } from "rbrgs/server/api/trpc";
import { rolesRouter } from "rbrgs/server/api/routers/roles";
import { teamRouter } from "rbrgs/server/api/routers/team";
import { judgeRouter } from "rbrgs/server/api/routers/judge";
import { scoreboardRouter } from "./routers/scoreboard";
import { bracketRouter } from "./routers/bracket";
import { adminRouter } from "./routers/admin";
import { configRouter } from "./routers/config";
import { interviewerRouter } from "./routers/interviewer";
/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  roles: rolesRouter,
  team: teamRouter,
  judge: judgeRouter,
  scoreboard: scoreboardRouter,
  admin: adminRouter,
  config: configRouter,
  interviewer: interviewerRouter,
  bracket: bracketRouter as unknown as typeof scoreboardRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
