import "server-only";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { recordAudit } from "@/lib/audit";
import {
  assertCan,
  assertClubScope,
  ForbiddenError,
  type AuthContext,
} from "@/lib/rbac";
import type {
  AssignCoachInput,
  CreateClubInput,
  CreateSeasonInput,
  CreateTeamInput,
  UpdateClubInput,
  UpdateSeasonInput,
  UpdateTeamInput,
} from "@/modules/clubs/schemas";

/**
 * Clubs module service layer — the AUTHORITATIVE place for authorization,
 * tenant scoping, and audit for clubs / seasons / teams / coach assignments
 * (BUILD_PLAN §2). Every function takes the caller's resolved AuthContext and
 * asserts permission + club scope BEFORE touching tenant data; cross-tenant
 * access throws ForbiddenError by construction. Routes/UI must go through here.
 */

/** Raised on a uniqueness conflict (duplicate short code / team code). */
export class ConflictError extends Error {
  readonly code = "CONFLICT";
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/** Club create/archive are system-level actions (Master Admin only, matrix §6.2). */
function assertMasterAdmin(ctx: AuthContext): void {
  if (ctx.role !== "MASTER_ADMIN") {
    throw new ForbiddenError("Only a Master Admin can perform this action");
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ===========================================================================
// Clubs
// ===========================================================================

export function listClubs(ctx: AuthContext) {
  assertMasterAdmin(ctx);
  return prisma.club.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function getClub(ctx: AuthContext, clubId: string) {
  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null } });
  if (!club) return null;
  assertCan(ctx, "clubs.view", { clubId });
  return club;
}

export async function createClub(ctx: AuthContext, input: CreateClubInput) {
  assertMasterAdmin(ctx);
  try {
    return await prisma.$transaction(async (tx) => {
      const club = await tx.club.create({
        data: {
          name: input.name,
          shortCode: input.shortCode,
          ...(input.timezone ? { timezone: input.timezone } : {}),
          createdBy: ctx.userId,
        },
      });
      await tx.clubSetting.create({ data: { clubId: club.id } });
      await recordAudit(tx, {
        action: "club.create",
        resourceType: "club",
        resourceId: club.id,
        clubId: club.id,
        actorUserId: ctx.userId,
        metadata: { name: club.name, shortCode: club.shortCode },
      });
      return club;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("A club with that short code already exists");
    throw error;
  }
}

export async function updateClub(ctx: AuthContext, clubId: string, input: UpdateClubInput) {
  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null } });
  if (!club) throw new ForbiddenError("Club not found");
  assertCan(ctx, "clubs.manage", { clubId });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.club.update({
      where: { id: clubId },
      data: { name: input.name, ...(input.timezone ? { timezone: input.timezone } : {}), updatedAt: new Date(), updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      action: "club.update",
      resourceType: "club",
      resourceId: clubId,
      clubId,
      actorUserId: ctx.userId,
      metadata: { name: updated.name },
    });
    return updated;
  });
}

export async function archiveClub(ctx: AuthContext, clubId: string) {
  assertMasterAdmin(ctx);
  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null } });
  if (!club) throw new ForbiddenError("Club not found");

  return prisma.$transaction(async (tx) => {
    const archived = await tx.club.update({
      where: { id: clubId },
      data: { status: "ARCHIVED", deletedAt: new Date(), deletedBy: ctx.userId, updatedAt: new Date(), updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      action: "club.archive",
      resourceType: "club",
      resourceId: clubId,
      clubId,
      actorUserId: ctx.userId,
    });
    return archived;
  });
}

// ===========================================================================
// Seasons
// ===========================================================================

export function listSeasons(ctx: AuthContext, clubId: string) {
  assertCan(ctx, "seasons.view", { clubId });
  return prisma.season.findMany({
    where: { clubId },
    orderBy: { startDate: "desc" },
  });
}

export async function createSeason(ctx: AuthContext, clubId: string, input: CreateSeasonInput) {
  assertCan(ctx, "seasons.manage", { clubId });
  return prisma.$transaction(async (tx) => {
    const season = await tx.season.create({
      data: {
        clubId,
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        createdBy: ctx.userId,
      },
    });
    await recordAudit(tx, {
      action: "season.create",
      resourceType: "season",
      resourceId: season.id,
      clubId,
      actorUserId: ctx.userId,
      metadata: { name: season.name },
    });
    return season;
  });
}

export async function updateSeason(ctx: AuthContext, seasonId: string, input: UpdateSeasonInput) {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) throw new ForbiddenError("Season not found");
  assertCan(ctx, "seasons.manage", { clubId: season.clubId });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.season.update({
      where: { id: seasonId },
      data: {
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      },
    });
    await recordAudit(tx, {
      action: "season.update",
      resourceType: "season",
      resourceId: seasonId,
      clubId: season.clubId,
      actorUserId: ctx.userId,
    });
    return updated;
  });
}

export async function archiveSeason(ctx: AuthContext, seasonId: string) {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) throw new ForbiddenError("Season not found");
  assertCan(ctx, "seasons.manage", { clubId: season.clubId });

  return prisma.$transaction(async (tx) => {
    const archived = await tx.season.update({
      where: { id: seasonId },
      data: { status: "ARCHIVED", updatedAt: new Date(), updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      action: "season.archive",
      resourceType: "season",
      resourceId: seasonId,
      clubId: season.clubId,
      actorUserId: ctx.userId,
    });
    return archived;
  });
}

// ===========================================================================
// Teams
// ===========================================================================

export function listTeams(ctx: AuthContext, clubId: string, opts: { seasonId?: string } = {}) {
  assertClubScope(ctx, clubId);
  if (ctx.role === "PARENT") throw new ForbiddenError("Use the parent roster view");

  const where: Prisma.TeamWhereInput = { clubId, deletedAt: null };
  if (opts.seasonId) where.seasonId = opts.seasonId;
  // Coaches see only their assigned teams (TEAM scope); admins see all (CLUB).
  if (ctx.role === "COACH") where.id = { in: ctx.coachTeamIds };

  return prisma.team.findMany({
    where,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { season: { select: { id: true, name: true } } },
  });
}

export async function getTeam(ctx: AuthContext, teamId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, deletedAt: null },
    include: { season: { select: { id: true, name: true } } },
  });
  if (!team) return null;
  assertCan(ctx, "teams.view", { clubId: team.clubId, teamId });
  return team;
}

async function assertSeasonInClub(seasonId: string | null | undefined, clubId: string): Promise<void> {
  if (!seasonId) return;
  const season = await prisma.season.findFirst({ where: { id: seasonId, clubId } });
  if (!season) throw new ForbiddenError("Season does not belong to this club");
}

export async function createTeam(ctx: AuthContext, clubId: string, input: CreateTeamInput) {
  assertCan(ctx, "teams.manage", { clubId });
  await assertSeasonInClub(input.seasonId, clubId);
  try {
    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          clubId,
          name: input.name,
          teamCode: input.teamCode,
          seasonId: input.seasonId ?? null,
          ageGroup: input.ageGroup ?? null,
          division: input.division ?? null,
          competitiveLevel: input.competitiveLevel ?? null,
          createdBy: ctx.userId,
        },
      });
      await recordAudit(tx, {
        action: "team.create",
        resourceType: "team",
        resourceId: team.id,
        clubId,
        actorUserId: ctx.userId,
        metadata: { name: team.name, teamCode: team.teamCode },
      });
      return team;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("A team with that code already exists in this club");
    throw error;
  }
}

export async function updateTeam(ctx: AuthContext, teamId: string, input: UpdateTeamInput) {
  const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null } });
  if (!team) throw new ForbiddenError("Team not found");
  assertCan(ctx, "teams.manage", { clubId: team.clubId, teamId });
  await assertSeasonInClub(input.seasonId, team.clubId);

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.team.update({
        where: { id: teamId },
        data: {
          name: input.name,
          teamCode: input.teamCode,
          seasonId: input.seasonId ?? null,
          ageGroup: input.ageGroup ?? null,
          division: input.division ?? null,
          competitiveLevel: input.competitiveLevel ?? null,
          status: input.status,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        },
      });
      await recordAudit(tx, {
        action: "team.update",
        resourceType: "team",
        resourceId: teamId,
        clubId: team.clubId,
        actorUserId: ctx.userId,
      });
      return updated;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("A team with that code already exists in this club");
    throw error;
  }
}

export async function archiveTeam(ctx: AuthContext, teamId: string) {
  const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null } });
  if (!team) throw new ForbiddenError("Team not found");
  assertCan(ctx, "teams.manage", { clubId: team.clubId, teamId });

  return prisma.$transaction(async (tx) => {
    const archived = await tx.team.update({
      where: { id: teamId },
      data: { status: "ARCHIVED", deletedAt: new Date(), deletedBy: ctx.userId, updatedAt: new Date(), updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      action: "team.archive",
      resourceType: "team",
      resourceId: teamId,
      clubId: team.clubId,
      actorUserId: ctx.userId,
    });
    return archived;
  });
}

// ===========================================================================
// Coach assignment (team_coaches)
// ===========================================================================

export async function listTeamCoaches(ctx: AuthContext, teamId: string) {
  const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null }, select: { clubId: true } });
  if (!team) return [];
  assertCan(ctx, "teams.view", { clubId: team.clubId, teamId });
  return prisma.teamCoach.findMany({
    where: { teamId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Users with an active COACH role assignment in the club — candidates to assign. */
export async function listAssignableCoaches(ctx: AuthContext, clubId: string) {
  assertCan(ctx, "teams.manage", { clubId });
  const assignments = await prisma.userRoleAssignment.findMany({
    where: { clubId, status: "ACTIVE", role: { code: "COACH" } },
    select: {
      user: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
    },
  });
  // De-dupe by user id.
  const byId = new Map<string, (typeof assignments)[number]["user"]>();
  for (const a of assignments) byId.set(a.user.id, a.user);
  return [...byId.values()];
}

export async function assignCoach(ctx: AuthContext, input: AssignCoachInput) {
  const team = await prisma.team.findFirst({
    where: { id: input.teamId, deletedAt: null },
    select: { clubId: true },
  });
  if (!team) throw new ForbiddenError("Team not found");
  assertCan(ctx, "teams.manage", { clubId: team.clubId, teamId: input.teamId });

  // The assignee must be a member of this club.
  const membership = await prisma.userRoleAssignment.findFirst({
    where: { userId: input.userId, clubId: team.clubId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!membership) throw new ForbiddenError("User is not a member of this club");

  return prisma.$transaction(async (tx) => {
    const coach = await tx.teamCoach.upsert({
      where: { teamId_userId: { teamId: input.teamId, userId: input.userId } },
      create: {
        clubId: team.clubId,
        teamId: input.teamId,
        userId: input.userId,
        roleType: input.roleType,
        status: "ACTIVE",
        createdBy: ctx.userId,
      },
      update: { roleType: input.roleType, status: "ACTIVE" },
    });
    await recordAudit(tx, {
      action: "coach.assign",
      resourceType: "team_coach",
      resourceId: coach.id,
      clubId: team.clubId,
      actorUserId: ctx.userId,
      metadata: { teamId: input.teamId, userId: input.userId, roleType: input.roleType },
    });
    return coach;
  });
}

export async function removeCoach(ctx: AuthContext, teamId: string, userId: string) {
  const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null }, select: { clubId: true } });
  if (!team) throw new ForbiddenError("Team not found");
  assertCan(ctx, "teams.manage", { clubId: team.clubId, teamId });

  return prisma.$transaction(async (tx) => {
    const removed = await tx.teamCoach.update({
      where: { teamId_userId: { teamId, userId } },
      data: { status: "INACTIVE" },
    });
    await recordAudit(tx, {
      action: "coach.remove",
      resourceType: "team_coach",
      resourceId: removed.id,
      clubId: team.clubId,
      actorUserId: ctx.userId,
      metadata: { teamId, userId },
    });
    return removed;
  });
}

// ===========================================================================
// Dashboard summary
// ===========================================================================

// ===========================================================================
// Club settings (MVP feature/privacy flags)
// ===========================================================================

export async function getClubSettings(ctx: AuthContext, clubId: string) {
  assertCan(ctx, "clubs.view", { clubId });
  // The settings row is created with the club; ensure one exists defensively.
  const existing = await prisma.clubSetting.findUnique({ where: { clubId } });
  if (existing) return existing;
  return prisma.clubSetting.create({ data: { clubId } });
}

export interface UpdateClubSettingsInput {
  showPlayerPhotosToParents: boolean;
  allowParentChildEvaluationView: boolean;
  attendanceTrackingEnabled: boolean;
}

export async function updateClubSettings(ctx: AuthContext, clubId: string, input: UpdateClubSettingsInput) {
  assertCan(ctx, "clubs.manage", { clubId });
  return prisma.$transaction(async (tx) => {
    const updated = await tx.clubSetting.upsert({
      where: { clubId },
      create: { clubId, ...input },
      update: { ...input, updatedAt: new Date() },
    });
    await recordAudit(tx, {
      action: "club_settings.update",
      resourceType: "club_setting",
      resourceId: updated.id,
      clubId,
      actorUserId: ctx.userId,
      metadata: { ...input },
    });
    return updated;
  });
}

/** System-wide counts for the Master Admin dashboard (system scope). */
export async function getSystemSummary(ctx: AuthContext) {
  assertMasterAdmin(ctx);
  const [clubCount, teamCount, playerCount] = await Promise.all([
    prisma.club.count({ where: { deletedAt: null } }),
    prisma.team.count({ where: { deletedAt: null } }),
    prisma.player.count({ where: { deletedAt: null } }),
  ]);
  return { clubCount, teamCount, playerCount };
}

export async function getClubSummary(ctx: AuthContext, clubId: string) {
  assertCan(ctx, "clubs.view", { clubId });
  const [teamCount, seasonCount, activeSeasonCount, coachCount, playerCount] = await Promise.all([
    prisma.team.count({ where: { clubId, deletedAt: null, status: { not: "ARCHIVED" } } }),
    prisma.season.count({ where: { clubId, status: { not: "ARCHIVED" } } }),
    prisma.season.count({ where: { clubId, status: "ACTIVE" } }),
    prisma.teamCoach.count({ where: { clubId, status: "ACTIVE" } }),
    prisma.player.count({ where: { clubId, deletedAt: null } }),
  ]);
  return { teamCount, seasonCount, activeSeasonCount, coachCount, playerCount };
}
