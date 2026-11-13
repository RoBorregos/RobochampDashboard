import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import { BracketCategory } from "@prisma/client";

// Columns are matched by prefix because accents in headers/values may be mangled.
// Values are trimmed and inner runs of whitespace collapsed ("Ana   Perez").
const col = (r: Record<string, string>, prefix: string) =>
  (r[Object.keys(r).find((k) => k.startsWith(prefix)) ?? ""] ?? "")
    .trim()
    .replace(/\s+/g, " ");

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
        relax_column_count: true,
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

      // The engine talks to a remote DB, so cost is the number of queries:
      // this is a fixed handful instead of two per team.
      await ctx.db.$transaction(
        async (tx) => {
          await tx.rosterMember.deleteMany();
          await tx.team.createMany({
            data: data.map((t) => ({ name: t.name, ...t.fields })),
            skipDuplicates: true,
          });
          const teams = await tx.team.findMany({
            where: { name: { in: data.map((t) => t.name) } },
          });
          const idByName = new Map(teams.map((t) => [t.name, t.id]));

          // Teams that already existed keep their rows; refresh their details.
          await Promise.all(
            data.flatMap((t) => {
              const existing = teams.find((e) => e.name === t.name)!;
              const same =
                existing.category === t.fields.category &&
                existing.coach === t.fields.coach &&
                existing.school === t.fields.school;
              return same
                ? []
                : [tx.team.update({ where: { id: existing.id }, data: t.fields })];
            }),
          );

          await tx.rosterMember.createMany({
            data: data.flatMap((t) =>
              t.members.map((m) => ({
                teamId: idByName.get(t.name)!,
                name: col(m, "Nombre"),
                attended: col(m, "Asisti").toUpperCase() === "TRUE",
              })),
            ),
            skipDuplicates: true,
          });
        },
        { timeout: 60_000 },
      );

      return { teams: data.length, members: rows.length };
    }),

  // Cascades: also deletes the teams' rounds and scores, and unassigns users.
  deleteAllTeams: adminProcedure.mutation(async ({ ctx }) => {
    const { count } = await ctx.db.team.deleteMany();
    return { count };
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
