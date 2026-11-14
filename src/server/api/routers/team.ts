import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Role } from "@prisma/client";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const teamRouter = createTRPCRouter({
  createTeam: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        userArea: z
          .enum(["MECHANICS", "ELECTRONICS", "PROGRAMMING"])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Prevent duplicate names
      const existingTeam = await ctx.db.team.findUnique({
        where: { name: input.name },
      });
      if (existingTeam) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Team with this name already exists",
        });
      }

      // Create the new team
      const team = await ctx.db.team.create({
        data: { name: input.name },
      });

      // Clear any pending team request from this user
      await ctx.db.teamRequest.deleteMany({
        where: { userId: ctx.session.user.id },
      });

      // Assign user to the team and set role/interview area

      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          teamId: team.id,
          role:
            ctx.session.user.role === Role.ADMIN ||
            ctx.session.user.role === Role.JUDGE
              ? ctx.session.user.role
              : Role.CONTESTANT,
          ...(input.userArea ? { interviewArea: input.userArea } : {}),
        },
      });

      return team;
    }),
  getTeam: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findFirst({
      where: {
        id: ctx.session.user.id,
      },
    });

    if (!user?.teamId) {
      return null;
    }

    const team = await ctx.db.team.findFirst({
      where: {
        id: user?.teamId,
      },
      include: {
        members: true,
        rounds: {
          where: {
            isVisible: true,
          },
          select: {
            number: true,
            challenges: true,
            isVisible: true,
          },
          orderBy: {
            number: "asc",
          },
        },
        challengeA: true,
        challengeB: true,
        challengeC: true,
      },
    });
    console.log(team);
    return team;
  }),

  saveDriveLink: protectedProcedure
    .input(z.object({ teamId: z.string(), link: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.update({
        where: {
          id: input.teamId,
        },
        data: {
          id: input.teamId,
          driveLink: input.link,
        },
      });
      return team;
    }),

  saveGithubLink: protectedProcedure
    .input(z.object({ teamId: z.string(), link: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.update({
        where: {
          id: input.teamId,
        },
        data: {
          id: input.teamId,
          githubLink: input.link,
        },
      });
      return team;
    }),

  getTeamIds: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.team.findMany({
      select: {
        id: true,
        name: true,
        category: true,
      },
    });
  }),
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        team: true,
      },
    });
  }),

  getAllTeams: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.team.findMany({
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  }),

  getUserRequest: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.teamRequest.findFirst({
      where: {
        userId: ctx.session.user.id,
      },
    });
  }),

  requestTeamAssignment: protectedProcedure
    .input(
      z.object({
        requestedTeam: z.string(),
        message: z.string().optional(),
        userArea: z.enum(["MECHANICS", "ELECTRONICS", "PROGRAMMING"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        include: { team: true },
      });

      if (user?.team) {
        throw new Error("User already has a team");
      }

      const team = await ctx.db.team.findUnique({
        where: { name: input.requestedTeam },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });
      if (team && team._count.members >= 4) {
        throw new Error("Team is full. Please choose another team.");
      }

      const existingRequest = await ctx.db.teamRequest.findFirst({
        where: { userId: ctx.session.user.id },
      });

      if (existingRequest) {
        // Update both the team request and the user's area
        await ctx.db.user.update({
          where: { id: ctx.session.user.id },
          data: { interviewArea: input.userArea },
        });

        return ctx.db.teamRequest.update({
          where: { id: existingRequest.id },
          data: {
            requestedTeam: input.requestedTeam,
            message: input.message,
            status: "PENDING",
          },
        });
      } else {
        // Update the user's area and create the request
        await ctx.db.user.update({
          where: { id: ctx.session.user.id },
          data: { interviewArea: input.userArea },
        });

        return ctx.db.teamRequest.create({
          data: {
            userId: ctx.session.user.id,
            requestedTeam: input.requestedTeam,
            message: input.message,
          },
        });
      }
    }),

  cancelTeamRequest: protectedProcedure.mutation(async ({ ctx }) => {
    const existingRequest = await ctx.db.teamRequest.findFirst({
      where: { userId: ctx.session.user.id },
    });

    if (!existingRequest) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No team request found to cancel.",
      });
    }

    await ctx.db.teamRequest.delete({
      where: { id: existingRequest.id },
    });

    return { success: true };
  }),

  leaveTeam: protectedProcedure.mutation(async ({ ctx }) => {
    const teamRequest = await ctx.db.teamRequest.findFirst({
      where: { userId: ctx.session.user.id },
    });

    if (teamRequest) {
      await ctx.db.teamRequest.delete({
        where: { id: teamRequest.id },
      });
    }

    await ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: {
        teamId: null,
        role:
          ctx.session.user.role === Role.CONTESTANT
            ? Role.UNASSIGNED
            : ctx.session.user.role,
      },
    });

    return { success: true };
  }),

  // Get visible schedules for all active teams (public access)
  getVisibleSchedules: publicProcedure.query(async ({ ctx }) => {
    const teams = await ctx.db.team.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        rounds: {
          where: {
            isVisible: true,
          },
          include: {
            challenges: true,
          },
          orderBy: {
            number: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return teams;
  }),

  // Requests moderation by team members
  getPendingRequestsForMyTeam: protectedProcedure.query(async ({ ctx }) => {
    const me = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: { team: true },
    });

    if (!me?.team) {
      return [];
    }

    return ctx.db.teamRequest.findMany({
      where: {
        status: "PENDING",
        requestedTeam: me.team.name,
      },
      include: {
        user: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  approveTeamRequestByMember: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const me = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        include: { team: true },
      });

      if (!me?.team) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not in a team",
        });
      }

      const request = await ctx.db.teamRequest.findUnique({
        where: { id: input.requestId },
      });
      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }
      if (request.requestedTeam !== me.team.name) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This request is not for your team",
        });
      }

      // Ensure team exists and has capacity
      const team = await ctx.db.team.findUnique({
        where: { id: me.team.id },
        include: { _count: { select: { members: true } } },
      });
      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }
      if (team._count.members >= 4) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Team is full" });
      }

      // Determine target user's role; keep ADMIN/JUDGE, else set as CONTESTANT
      const targetUser = await ctx.db.user.findUnique({
        where: { id: request.userId },
        select: { role: true },
      });

      await ctx.db.user.update({
        where: { id: request.userId },
        data: {
          teamId: team.id,
          role:
            targetUser?.role === Role.UNASSIGNED
              ? Role.CONTESTANT
              : (targetUser?.role as Role),
        },
      });

      await ctx.db.teamRequest.update({
        where: { id: input.requestId },
        data: { status: "APPROVED" },
      });

      return { success: true };
    }),

  rejectTeamRequestByMember: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const me = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        include: { team: true },
      });
      if (!me?.team) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not in a team",
        });
      }

      const request = await ctx.db.teamRequest.findUnique({
        where: { id: input.requestId },
      });
      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }
      if (request.requestedTeam !== me.team.name) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This request is not for your team",
        });
      }

      await ctx.db.teamRequest.update({
        where: { id: input.requestId },
        data: { status: "REJECTED" },
      });

      return { success: true };
    }),
});

export type TeamType =
  ReturnType<typeof teamRouter._def.procedures.getTeam> extends Promise<infer T>
    ? T
    : never;
