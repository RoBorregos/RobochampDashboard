import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import { BracketCategory } from "@prisma/client";

// Columns are matched by prefix because accents in headers/values may be mangled.
const col = (r: Record<string, string>, prefix: string) =>
  r[Object.keys(r).find((k) => k.startsWith(prefix)) ?? ""] ?? "";

const categoryOf = (value: string) => {
  if (/A \(/.test(value)) return BracketCategory.BEGINNERS;
  if (/B \(/.test(value)) return BracketCategory.ADVANCED;
  throw new Error(`Unknown category: "${value}"`);
};

export const teamManagementRouter = createTRPCRouter({
  getAllTeams: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.team.findMany({
      include: {
        members: true,
        roster: { orderBy: { name: "asc" } },
        _count: {
          select: { members: true },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  }),

  // Replaces the whole selection roster with the uploaded CSV
  // (columns: Nombre completo, Equipo, Categoría, Coach, Prepa, Asistió).
  importSelectionCsv: adminProcedure
    .input(z.object({ csv: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rows = parse(input.csv, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as Record<string, string>[];

      const teams = new Map<string, typeof rows>();
      for (const r of rows) {
        const name = col(r, "Equipo");
        if (!name || !col(r, "Nombre")) {
          throw new Error("Each row needs 'Nombre completo' and 'Equipo'.");
        }
        teams.set(name, [...(teams.get(name) ?? []), r]);
      }

      // Validate every category before touching the DB.
      const data = [...teams].map(([name, members]) => ({
        name,
        members,
        fields: {
          category: categoryOf(col(members[0]!, "Categor")),
          coach: col(members[0]!, "Coach"),
          school: col(members[0]!, "Prepa"),
        },
      }));

      // Many round trips to a remote DB: Prisma's 5s default would roll it back.
      await ctx.db.$transaction(
        async (tx) => {
          await tx.rosterMember.deleteMany();
          for (const t of data) {
            const team = await tx.team.upsert({
              where: { name: t.name },
              create: { name: t.name, ...t.fields },
              update: t.fields,
            });
            await tx.rosterMember.createMany({
              data: t.members.map((m) => ({
                teamId: team.id,
                name: col(m, "Nombre"),
                attended: col(m, "Asisti").toUpperCase() === "TRUE",
              })),
              skipDuplicates: true,
            });
          }
        },
        { timeout: 60_000 },
      );

      return { teams: data.length, members: rows.length };
    }),

  createTeam: adminProcedure
    .input(
      z.object({
        name: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.team.create({
        data: {
          name: input.name,
        },
      });
    }),

  getTeams: adminProcedure.query(async ({ ctx }) => {
    return await ctx.db.team.findMany({
      include: {
        members: true,
        rounds: {
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
  }),

  toggleTeamStatus: adminProcedure
    .input(
      z.object({
        teamId: z.string(),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updatedTeam = await ctx.db.team.update({
        where: { id: input.teamId },
        data: { isActive: input.isActive },
      });

      return {
        success: true,
        team: updatedTeam,
      };
    }),
});
