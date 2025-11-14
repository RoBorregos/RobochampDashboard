import { z } from "zod";

import { createTRPCRouter, judgeProcedure } from "rbrgs/server/api/trpc";
import {
  challengeASchema,
  challengeBSchema,
  challengeCSchema,
} from "rbrgs/lib/schemas";

const computePointsLOP = (lackOfProgress: number) => {
  switch (lackOfProgress) {
    case 0:
      return 20;
    case 1:
      return 10;
    case 2:
      return 5;
    default:
      return 0;
  }
};

export const judgeRouter = createTRPCRouter({
  roundA: judgeProcedure
    .input(challengeASchema)
    .mutation(async ({ ctx, input }) => {
      const red = input.redCubes ?? 0;
      const green = input.greenCubes ?? 0;
      const blue = input.blueCubes ?? 0;
      const yellow = input.yellowCubes ?? 0;
      const seesaw = input.seesawCrossings ?? 0;
      const cables = input.cablesCut ?? 0;
      const incorrect = input.incorrectCut ?? false;

      let points = 0;

      let zoneAPoints = 0;
      zoneAPoints += red * 10;
      zoneAPoints += green * 10;
      zoneAPoints += blue * 10;
      zoneAPoints += yellow * 35;
      zoneAPoints += seesaw * 25;
      if (zoneAPoints > 120) zoneAPoints = 120;

      let zoneBPoints = cables * 20;
      if (zoneBPoints > 80) zoneBPoints = 80;

      points += zoneAPoints + zoneBPoints;

      if (zoneAPoints === 120 && zoneBPoints === 80) {
        points += input.genericFormSchema.roundTimeSeconds ?? 0;
      }

      points += computePointsLOP(input.genericFormSchema.lackOfProgress);

      // Cast to any while Prisma client types are regenerated locally
      return await ctx.db.challengeA.create({
        data: {
          finishedTrack: input.finishedTrack,
          obtainedBonus: input.genericFormSchema.obtainedBonus,
          roundTimeSeconds: input.genericFormSchema.roundTimeSeconds,
          lackOfProgress: input.genericFormSchema.lackOfProgress,
          roundId: input.genericFormSchema.roundId,
          teamId: input.genericFormSchema.teamId,
          judgeID: ctx.session.user.id,
          points: points,
          redCubes: red,
          greenCubes: green,
          blueCubes: blue,
          yellowCubes: yellow,
          seesawCrossings: seesaw,
          cablesCut: cables,
          incorrectCut: incorrect,
        },
      });
    }),

  roundB: judgeProcedure
    .input(challengeBSchema)
    .mutation(async ({ ctx, input }) => {
      let points = 0;
      points += input.trackData.trackPoints;
      points += computePointsLOP(input.genericFormSchema.lackOfProgress);

      return await ctx.db.challengeB.create({
        data: {
          trackPoints: input.trackData.trackPoints,
          patternsPassed: input.trackData.patternsPassed,
          lackOfProgress: input.genericFormSchema.lackOfProgress,
          points: points,
          roundTimeSeconds: input.genericFormSchema.roundTimeSeconds,
          teamId: input.genericFormSchema.teamId,
          judgeID: ctx.session.user.id,
          roundId: input.genericFormSchema.roundId,
        },
      });
    }),

  roundC: judgeProcedure
    .input(challengeCSchema)
    .mutation(async ({ ctx, input }) => {
      let points = 0;
      points += input.detectedColors * 3;
      points += input.passedObstacles * 8;
      points += input.finishedTrack ? 35 : 0;
      points += input.genericFormSchema.obtainedBonus ? 41 : 0;

      points += input.passedRamp ? 10 : 0;
      points += input.crossedRampWithoutLOP ? 10 : 0;
      points += input.reverseRamp ? 40 : 0;
      points += input.crossedRampWithoutTouching ? 20 : 0;
      points += computePointsLOP(input.genericFormSchema.lackOfProgress);

      return await ctx.db.challengeC.create({
        data: {
          detectedColors: input.detectedColors,
          finishedTrack: input.finishedTrack,
          obtainedBonus: input.genericFormSchema.obtainedBonus,

          passedObstacles: input.passedObstacles,
          passedRamp: input.passedRamp,
          crossedRampWithoutLOP: input.crossedRampWithoutLOP,
          crossedRampWithoutTouching: input.crossedRampWithoutTouching,
          reverseRamp: input.reverseRamp,

          lackOfProgress: input.genericFormSchema.lackOfProgress,
          points: points,
          roundTimeSeconds: input.genericFormSchema.roundTimeSeconds,
          teamId: input.genericFormSchema.teamId,
          judgeID: ctx.session.user.id,
          roundId: input.genericFormSchema.roundId,
        },
      });
    }),

  getTeamIds: judgeProcedure.query(async ({ ctx }) => {
    const team = await ctx.db.team.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    return team;
  }),
  roundADelete: judgeProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.challengeA.delete({
        where: {
          id: input.id,
        },
      });
    }),
  roundBDelete: judgeProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.challengeB.delete({
        where: {
          id: input.id,
        },
      });
    }),
  roundCDelete: judgeProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.challengeC.delete({
        where: {
          id: input.id,
        },
      });
    }),
});
