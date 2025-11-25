import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const roundControlRouter = createTRPCRouter({
  getConfig: adminProcedure.query(async ({ ctx }) => {
    try {
      let config = await ctx.db.config.findFirst();

      config ??= await ctx.db.config.create({
        data: {
          freeze: true,
          competitionStarted: false,
          currentRound: 1,
          roundsRevealed: 0,
        },
      });

      return config;
    } catch {
      console.warn("Config table not found, using default configuration");
      return {
        id: 1,
        freeze: true,
        competitionStarted: false,
        currentRound: 1,
        roundsRevealed: 0,
      };
    }
  }),

  updateConfig: adminProcedure
    .input(
      z.object({
        round1StartTime: z.string().optional(),
        round2StartTime: z.string().optional(),
        round3StartTime: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: review mutation
      return { success: true, config: input };
    }),

  toggleRoundVisibility: adminProcedure
    .input(
      z.object({
        roundNumber: z.number().min(1).max(3),
        isVisible: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log(
        `Toggling round ${input.roundNumber} to ${input.isVisible ? "visible" : "hidden"}`,
      );

      try {
        const updateResult = await ctx.db.round.updateMany({
          where: { number: input.roundNumber },
          data: { isVisible: input.isVisible },
        });

        console.log(`Updated ${updateResult.count} rounds`);

        let config;
        try {
          config = await ctx.db.config.findFirst();
          config ??= await ctx.db.config.create({
            data: {
              freeze: true,
              competitionStarted: false,
              currentRound: 1,
              roundsRevealed: 0,
            },
          });

          const visibleRoundsCount = await ctx.db.round
            .findMany({
              where: { isVisible: true },
              select: { number: true },
              distinct: ["number"],
            })
            .then((rounds) => rounds.length);

          const hasAnyVisible = visibleRoundsCount > 0;

          await ctx.db.config.update({
            where: { id: config.id },
            data: {
              roundsRevealed: visibleRoundsCount,
              competitionStarted: hasAnyVisible,
            },
          });

          console.log(`Config updated: ${visibleRoundsCount} rounds revealed`);
        } catch (configError) {
          console.warn("Config table error (ignoring):", configError);
        }

        return {
          success: true,
          roundNumber: input.roundNumber,
          isVisible: input.isVisible,
          totalRevealed: config
            ? await ctx.db.round.count({ where: { isVisible: true } })
            : 0,
        };
      } catch (error) {
        console.error("Error toggling round visibility:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to ${input.isVisible ? "reveal" : "hide"} round ${input.roundNumber}: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  getRoundVisibilityStatus: adminProcedure.query(async ({ ctx }) => {
    try {
      const rounds = await ctx.db.round.findMany({
        select: {
          number: true,
          isVisible: true,
        },
        distinct: ["number"],
      });

      const roundStatus: Record<number, boolean> = {
        1: false,
        2: false,
        3: false,
      };

      rounds.forEach((round) => {
        if (round.isVisible) {
          roundStatus[round.number] = true;
        }
      });

      console.log("Round visibility status:", roundStatus);
      return roundStatus;
    } catch (error) {
      console.error("Error getting round visibility:", error);
      return { 1: false, 2: false, 3: false };
    }
  }),

  revealNextRound: adminProcedure.mutation(async ({ ctx }) => {
    try {
      const visibleRounds = await ctx.db.round.groupBy({
        by: ["number"],
        where: { isVisible: true },
        _count: { number: true },
      });

      const revealedNumbers = visibleRounds.map((r) => r.number).sort();
      let nextRound = 1;

      for (let i = 1; i <= 3; i++) {
        if (!revealedNumbers.includes(i)) {
          nextRound = i;
          break;
        }
      }

      if (revealedNumbers.length >= 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "All rounds are already revealed",
        });
      }

      await ctx.db.round.updateMany({
        where: { number: nextRound },
        data: { isVisible: true },
      });

      // Update config
      let config = await ctx.db.config.findFirst();
      config ??= await ctx.db.config.create({
        data: {
          freeze: true,
          competitionStarted: false,
          currentRound: 1,
          roundsRevealed: 0,
        },
      });

      const totalVisible = revealedNumbers.length + 1;
      await ctx.db.config.update({
        where: { id: config.id },
        data: {
          roundsRevealed: totalVisible,
          competitionStarted: true,
        },
      });

      return {
        success: true,
        roundNumber: nextRound,
        isVisible: true,
        totalRevealed: totalVisible,
      };
    } catch (err) {
      console.error("Error revealing next round:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to reveal next round",
      });
    }
  }),
});
