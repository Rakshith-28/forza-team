import "server-only";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { recordAudit, recordAuditStandalone } from "@/lib/audit";
import { ForbiddenError, type AuthContext } from "@/lib/rbac";
import {
  createInvitation,
  resendInvitation,
  revokeInvitation,
} from "@/modules/identity/invitations";
import {
  normalizePage,
  type ClubAdminInviteInput,
  type ClubStatus,
  type Paginated,
  type PageParams,
} from "@/modules/master/schemas";

/** Raised on a uniqueness/duplicate conflict; surfaced as a friendly error at the action layer. */
export class ConflictError extends Error {
  readonly code = "CONFLICT";
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export type ClubAdminState = "ok" | "pending" | "none";

/**
 * Orphan-club state from admin presence (pure — unit-testable): an active admin
 * means healthy; otherwise a pending invite means "pending"; nothing means
 * "none" (a true orphan).
 */
export function clubAdminState(hasActiveAdmin: boolean, hasPendingInvite: boolean): ClubAdminState {
  if (hasActiveAdmin) return "ok";
  if (hasPendingInvite) return "pending";
  return "none";
}

/**
 * Master module service layer — system-scope reads/writes for the Master Admin
 * portal (BUILD_PLAN §2 reporting/admin surface). Master Admin is cross-tenant
 * BY DESIGN (see scope.ts `clubMatches`), so these functions intentionally span
 * every club; the single guard each one needs is `assertMasterAdmin`. No other
 * role may reach this module.
 *
 * All counts/lists respect soft-delete (`deletedAt: null`) where the model has
 * it, and use Prisma aggregates (`count` / `_count` / `distinct`) — never N+1.
 */

/** The one authorization gate for the entire module. */
function assertMasterAdmin(ctx: AuthContext): void {
  if (ctx.role !== "MASTER_ADMIN") {
    throw new ForbiddenError("Master Admin access required");
  }
}

export interface MasterDashboardSummary {
  clubs: number;
  activeClubs: number;
  teams: number;
  players: number;
  coaches: number;
  parents: number;
  users: number;
  openInvoices: number;
  overdueInvoices: number;
  upcomingEvents: number;
  activeEvaluationCycles: number;
  waiverAcceptances: number;
}

/**
 * System-wide totals for the Master Admin dashboard. Each metric degrades to 0
 * when its module has no data yet. Distinct-user counts (coaches/parents) are
 * by active role assignment.
 */
export async function getMasterDashboardSummary(ctx: AuthContext): Promise<MasterDashboardSummary> {
  assertMasterAdmin(ctx);
  const now = new Date();

  const [
    clubs,
    activeClubs,
    teams,
    players,
    coachAssignments,
    parentAssignments,
    users,
    openInvoices,
    overdueInvoices,
    upcomingEvents,
    activeEvaluationCycles,
    waiverAcceptances,
  ] = await Promise.all([
    prisma.club.count({ where: { deletedAt: null } }),
    prisma.club.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.team.count({ where: { deletedAt: null } }),
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.userRoleAssignment.findMany({
      where: { status: "ACTIVE", role: { code: "COACH" } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.userRoleAssignment.findMany({
      where: { status: "ACTIVE", role: { code: "PARENT" } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.user.count(),
    prisma.invoice.count({ where: { status: { in: ["OPEN", "PARTIALLY_PAID"] } } }),
    prisma.invoice.count({ where: { status: "OVERDUE" } }),
    prisma.event.count({ where: { status: "SCHEDULED", startAt: { gte: now } } }),
    prisma.evaluationCycle.count({ where: { status: "ACTIVE" } }),
    prisma.waiverAcceptance.count(),
  ]);

  return {
    clubs,
    activeClubs,
    teams,
    players,
    coaches: coachAssignments.length,
    parents: parentAssignments.length,
    users,
    openInvoices,
    overdueInvoices,
    upcomingEvents,
    activeEvaluationCycles,
    waiverAcceptances,
  };
}

// ===========================================================================
// Clubs — list (dashboard panel + Clubs page) and detail (drawer)
// ===========================================================================

export interface MasterClubListItem {
  id: string;
  name: string;
  shortCode: string;
  logoUrl: string | null;
  city: string | null;
  state: string | null;
  status: string;
  createdAt: Date;
  teamCount: number;
  playerCount: number;
  userCount: number;
  /** Orphan indicator: ok = has an active admin; pending = invite out; none = orphan. */
  adminState: ClubAdminState;
}

export interface MasterClubFilters extends PageParams {
  search?: string;
  status?: ClubStatus;
}

/** Tally distinct users per club from (clubId,userId) pairs. */
function tallyDistinctUsers(pairs: { clubId: string | null }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of pairs) {
    if (!p.clubId) continue;
    counts.set(p.clubId, (counts.get(p.clubId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Paginated club list with per-club team / player / distinct-user counts.
 * Drives both the dashboard Clubs panel and the Clubs page table. Counts are
 * gathered with one grouped query each over the page's club ids (no N+1) and
 * respect soft-delete.
 */
export async function getMasterClubs(
  ctx: AuthContext,
  filters: MasterClubFilters = {},
): Promise<Paginated<MasterClubListItem>> {
  assertMasterAdmin(ctx);
  const { page, pageSize, skip, take } = normalizePage(filters);

  const where: Prisma.ClubWhereInput = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { shortCode: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, clubs] = await Promise.all([
    prisma.club.count({ where }),
    prisma.club.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        shortCode: true,
        logoUrl: true,
        city: true,
        state: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const clubIds = clubs.map((c) => c.id);
  const [teamGroups, playerGroups, userPairs, activeAdmins, pendingAdminInvites] = clubIds.length
    ? await Promise.all([
        prisma.team.groupBy({ by: ["clubId"], where: { clubId: { in: clubIds }, deletedAt: null }, _count: { _all: true } }),
        prisma.player.groupBy({ by: ["clubId"], where: { clubId: { in: clubIds }, deletedAt: null }, _count: { _all: true } }),
        prisma.userRoleAssignment.findMany({
          where: { clubId: { in: clubIds }, status: "ACTIVE" },
          select: { clubId: true, userId: true },
          distinct: ["clubId", "userId"],
        }),
        prisma.userRoleAssignment.findMany({
          where: { clubId: { in: clubIds }, status: "ACTIVE", role: { code: "CLUB_ADMIN" } },
          select: { clubId: true },
          distinct: ["clubId"],
        }),
        prisma.invitation.findMany({
          where: { clubId: { in: clubIds }, roleCode: "CLUB_ADMIN", status: "PENDING" },
          select: { clubId: true },
          distinct: ["clubId"],
        }),
      ])
    : [[], [], [], [], []];

  const teamCounts = new Map(teamGroups.map((g) => [g.clubId, g._count._all]));
  const playerCounts = new Map(playerGroups.map((g) => [g.clubId, g._count._all]));
  const userCounts = tallyDistinctUsers(userPairs);
  const adminClubIds = new Set(activeAdmins.map((a) => a.clubId));
  const pendingAdminClubIds = new Set(pendingAdminInvites.map((a) => a.clubId));

  const rows: MasterClubListItem[] = clubs.map((c) => ({
    ...c,
    teamCount: teamCounts.get(c.id) ?? 0,
    playerCount: playerCounts.get(c.id) ?? 0,
    userCount: userCounts.get(c.id) ?? 0,
    adminState: clubAdminState(adminClubIds.has(c.id), pendingAdminClubIds.has(c.id)),
  }));

  return { rows, total, page, pageSize };
}

export interface MasterClubDetail {
  id: string;
  name: string;
  shortCode: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  website: string | null;
  status: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  metrics: {
    teams: number;
    players: number;
    users: number;
    coaches: number;
    parents: number;
    openInvoices: number;
    waiverAcceptances: number;
    activeEvaluationCycles: number;
  };
  teams: {
    id: string;
    name: string;
    teamCode: string;
    ageGroup: string | null;
    seasonName: string | null;
    status: string;
    playerCount: number;
    headCoachName: string | null;
  }[];
  users: { userId: string; name: string; email: string; status: string; roleCodes: string[] }[];
  settings: {
    enableAiFeatures: boolean;
    enableSmsNotifications: boolean;
    defaultCurrency: string;
    registrationEnabled: boolean;
    billingEnabled: boolean;
    attendanceTrackingEnabled: boolean;
    showPlayerPhotosToParents: boolean;
    allowParentChildEvaluationView: boolean;
    allowCoachInviteParents: boolean;
    allowParentToParentChat: boolean;
  } | null;
  recentAudit: {
    id: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    actorName: string | null;
    createdAt: Date;
  }[];
  clubAdmins: ClubAdminRow[];
  adminState: ClubAdminState;
}

function personName(u: { name: string | null; firstName: string; lastName: string; email: string }): string {
  return u.name?.trim() || `${u.firstName} ${u.lastName}`.trim() || u.email;
}

/** Full detail for one club (Overview/Teams/Users/Settings/Audit drawer). */
export async function getMasterClubDetail(ctx: AuthContext, clubId: string): Promise<MasterClubDetail | null> {
  assertMasterAdmin(ctx);

  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null } });
  if (!club) return null;

  const clubAdmins = await getClubAdmins(ctx, clubId);

  const [
    teamCount,
    playerCount,
    userPairs,
    coachPairs,
    parentPairs,
    openInvoices,
    waiverAcceptances,
    activeEvaluationCycles,
    teams,
    assignments,
    settings,
    recentAudit,
  ] = await Promise.all([
    prisma.team.count({ where: { clubId, deletedAt: null } }),
    prisma.player.count({ where: { clubId, deletedAt: null } }),
    prisma.userRoleAssignment.findMany({ where: { clubId, status: "ACTIVE" }, select: { userId: true }, distinct: ["userId"] }),
    prisma.userRoleAssignment.findMany({ where: { clubId, status: "ACTIVE", role: { code: "COACH" } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.userRoleAssignment.findMany({ where: { clubId, status: "ACTIVE", role: { code: "PARENT" } }, select: { userId: true }, distinct: ["userId"] }),
    prisma.invoice.count({ where: { clubId, status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] } } }),
    prisma.waiverAcceptance.count({ where: { clubId } }),
    prisma.evaluationCycle.count({ where: { clubId, status: "ACTIVE" } }),
    prisma.team.findMany({
      where: { clubId, deletedAt: null },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        teamCode: true,
        ageGroup: true,
        status: true,
        season: { select: { name: true } },
        teamCoaches: {
          where: { status: "ACTIVE", roleType: "HEAD_COACH" },
          select: { user: { select: { name: true, firstName: true, lastName: true, email: true } } },
          take: 1,
        },
      },
    }),
    prisma.userRoleAssignment.findMany({
      where: { clubId, status: "ACTIVE" },
      select: {
        user: { select: { id: true, name: true, firstName: true, lastName: true, email: true, status: true } },
        role: { select: { code: true } },
      },
    }),
    prisma.clubSetting.findUnique({ where: { clubId } }),
    prisma.auditLog.findMany({
      where: { clubId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, action: true, resourceType: true, resourceId: true, actorUserId: true, createdAt: true },
    }),
  ]);

  // Per-team player counts (one grouped query) + head-coach names already joined.
  const teamIds = teams.map((t) => t.id);
  const playerGroups = teamIds.length
    ? await prisma.playerTeamMembership.groupBy({
        by: ["teamId"],
        where: { teamId: { in: teamIds }, status: "ACTIVE" },
        _count: { _all: true },
      })
    : [];
  const teamPlayerCounts = new Map(playerGroups.map((g) => [g.teamId, g._count._all]));

  // Resolve actor names for the recent audit rows in one query.
  const actorIds = [...new Set(recentAudit.map((a) => a.actorUserId).filter((x): x is string => !!x))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, firstName: true, lastName: true, email: true } })
    : [];
  const actorById = new Map(actors.map((a) => [a.id, personName(a)]));

  // Collapse role assignments into one row per user with their role codes.
  const usersById = new Map<string, MasterClubDetail["users"][number]>();
  for (const a of assignments) {
    const existing = usersById.get(a.user.id);
    if (existing) {
      if (!existing.roleCodes.includes(a.role.code)) existing.roleCodes.push(a.role.code);
    } else {
      usersById.set(a.user.id, {
        userId: a.user.id,
        name: personName(a.user),
        email: a.user.email,
        status: a.user.status,
        roleCodes: [a.role.code],
      });
    }
  }

  return {
    id: club.id,
    name: club.name,
    shortCode: club.shortCode,
    logoUrl: club.logoUrl,
    primaryColor: club.primaryColor,
    secondaryColor: club.secondaryColor,
    addressLine1: club.addressLine1,
    addressLine2: club.addressLine2,
    city: club.city,
    state: club.state,
    postalCode: club.postalCode,
    country: club.country,
    phone: club.phone,
    website: club.website,
    status: club.status,
    timezone: club.timezone,
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
    metrics: {
      teams: teamCount,
      players: playerCount,
      users: userPairs.length,
      coaches: coachPairs.length,
      parents: parentPairs.length,
      openInvoices,
      waiverAcceptances,
      activeEvaluationCycles,
    },
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      teamCode: t.teamCode,
      ageGroup: t.ageGroup,
      seasonName: t.season?.name ?? null,
      status: t.status,
      playerCount: teamPlayerCounts.get(t.id) ?? 0,
      headCoachName: t.teamCoaches[0] ? personName(t.teamCoaches[0].user) : null,
    })),
    users: [...usersById.values()].sort((a, b) => a.name.localeCompare(b.name)),
    settings: settings
      ? {
          enableAiFeatures: settings.enableAiFeatures,
          enableSmsNotifications: settings.enableSmsNotifications,
          defaultCurrency: settings.defaultCurrency,
          registrationEnabled: settings.registrationEnabled,
          billingEnabled: settings.billingEnabled,
          attendanceTrackingEnabled: settings.attendanceTrackingEnabled,
          showPlayerPhotosToParents: settings.showPlayerPhotosToParents,
          allowParentChildEvaluationView: settings.allowParentChildEvaluationView,
          allowCoachInviteParents: settings.allowCoachInviteParents,
          allowParentToParentChat: settings.allowParentToParentChat,
        }
      : null,
    recentAudit: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      resourceType: a.resourceType,
      resourceId: a.resourceId,
      actorName: a.actorUserId ? (actorById.get(a.actorUserId) ?? null) : null,
      createdAt: a.createdAt,
    })),
    clubAdmins,
    adminState: clubAdminState(
      clubAdmins.some((a) => a.status === "ACTIVE"),
      clubAdmins.some((a) => a.status === "PENDING"),
    ),
  };
}

// ===========================================================================
// System settings — global, platform-wide singleton (distinct from club_settings)
// ===========================================================================

const SYSTEM_SETTINGS_ID = "system";

export interface SystemSettingsData {
  aiFeaturesEnabled: boolean;
  maintenanceMode: boolean;
  defaultCurrency: string;
  defaultRegistrationEnabled: boolean;
  defaultBillingEnabled: boolean;
  defaultSmsNotifications: boolean;
  updatedAt: Date;
}

function toSystemSettingsData(row: {
  aiFeaturesEnabled: boolean;
  maintenanceMode: boolean;
  defaultCurrency: string;
  defaultRegistrationEnabled: boolean;
  defaultBillingEnabled: boolean;
  defaultSmsNotifications: boolean;
  updatedAt: Date;
}): SystemSettingsData {
  return {
    aiFeaturesEnabled: row.aiFeaturesEnabled,
    maintenanceMode: row.maintenanceMode,
    defaultCurrency: row.defaultCurrency,
    defaultRegistrationEnabled: row.defaultRegistrationEnabled,
    defaultBillingEnabled: row.defaultBillingEnabled,
    defaultSmsNotifications: row.defaultSmsNotifications,
    updatedAt: row.updatedAt,
  };
}

/** Read the global settings, creating the singleton row on first access. */
export async function getSystemSettings(ctx: AuthContext): Promise<SystemSettingsData> {
  assertMasterAdmin(ctx);
  const existing = await prisma.systemSettings.findUnique({ where: { id: SYSTEM_SETTINGS_ID } });
  if (existing) return toSystemSettingsData(existing);
  const created = await prisma.systemSettings.create({ data: { id: SYSTEM_SETTINGS_ID } });
  return toSystemSettingsData(created);
}

export interface UpdateSystemSettingsInput {
  aiFeaturesEnabled: boolean;
  maintenanceMode: boolean;
  defaultCurrency: string;
  defaultRegistrationEnabled: boolean;
  defaultBillingEnabled: boolean;
  defaultSmsNotifications: boolean;
}

/** Update the global settings (master-only, audited). */
export async function updateSystemSettings(
  ctx: AuthContext,
  input: UpdateSystemSettingsInput,
): Promise<SystemSettingsData> {
  assertMasterAdmin(ctx);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.systemSettings.upsert({
      where: { id: SYSTEM_SETTINGS_ID },
      create: { id: SYSTEM_SETTINGS_ID, ...input },
      update: { ...input, updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      // resource_id is a UUID column; the singleton's id ("system") isn't a UUID,
      // so record it in metadata and leave resourceId null.
      action: "system_settings.update",
      resourceType: "system_settings",
      resourceId: null,
      actorUserId: ctx.userId,
      metadata: { id: SYSTEM_SETTINGS_ID, ...input },
    });
    return toSystemSettingsData(updated);
  });
}

/** Club id+name options for filter dropdowns (non-deleted, alphabetical). */
export async function listClubOptions(ctx: AuthContext): Promise<{ id: string; name: string }[]> {
  assertMasterAdmin(ctx);
  return prisma.club.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

// ===========================================================================
// Coaches — platform-wide list + detail
// ===========================================================================

export interface MasterCoachRow {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  lastLoginAt: Date | null;
  clubs: { id: string; name: string }[];
  teams: { teamId: string; teamName: string; roleType: string }[];
  roleTypes: string[];
}

export interface MasterCoachFilters extends PageParams {
  search?: string;
  clubId?: string;
  status?: string;
  roleType?: string;
}

/**
 * All coaches platform-wide — users holding an ACTIVE COACH role assignment,
 * with their club(s) and team assignments (+ role types). Paginated/filtered
 * server-side over the users table; per-page club + team data is fetched with
 * two grouped queries (no N+1).
 */
export async function getMasterCoaches(
  ctx: AuthContext,
  filters: MasterCoachFilters = {},
): Promise<Paginated<MasterCoachRow>> {
  assertMasterAdmin(ctx);
  const { page, pageSize, skip, take } = normalizePage(filters);

  const where: Prisma.UserWhereInput = {
    roleAssignments: {
      some: {
        status: "ACTIVE",
        role: { code: "COACH" },
        ...(filters.clubId ? { clubId: filters.clubId } : {}),
      },
    },
  };
  if (filters.status) where.status = filters.status;
  if (filters.roleType) where.teamCoachRoles = { some: { status: "ACTIVE", roleType: filters.roleType } };
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take,
      select: { id: true, name: true, firstName: true, lastName: true, email: true, phone: true, status: true, lastLoginAt: true },
    }),
  ]);

  const userIds = users.map((u) => u.id);
  const [coachAssignments, teamCoaches] = userIds.length
    ? await Promise.all([
        prisma.userRoleAssignment.findMany({
          where: { userId: { in: userIds }, status: "ACTIVE", role: { code: "COACH" }, clubId: { not: null } },
          select: { userId: true, club: { select: { id: true, name: true } } },
        }),
        prisma.teamCoach.findMany({
          where: { userId: { in: userIds }, status: "ACTIVE" },
          select: { userId: true, roleType: true, team: { select: { id: true, name: true } } },
        }),
      ])
    : [[], []];

  const clubsByUser = new Map<string, Map<string, string>>();
  for (const a of coachAssignments) {
    if (!a.club) continue;
    const m = clubsByUser.get(a.userId) ?? new Map<string, string>();
    m.set(a.club.id, a.club.name);
    clubsByUser.set(a.userId, m);
  }
  const teamsByUser = new Map<string, MasterCoachRow["teams"]>();
  for (const tc of teamCoaches) {
    const list = teamsByUser.get(tc.userId) ?? [];
    list.push({ teamId: tc.team.id, teamName: tc.team.name, roleType: tc.roleType });
    teamsByUser.set(tc.userId, list);
  }

  const rows: MasterCoachRow[] = users.map((u) => {
    const teams = teamsByUser.get(u.id) ?? [];
    return {
      userId: u.id,
      name: u.name?.trim() || `${u.firstName} ${u.lastName}`.trim() || u.email,
      email: u.email,
      phone: u.phone,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      clubs: [...(clubsByUser.get(u.id) ?? new Map()).entries()].map(([id, name]) => ({ id, name })),
      teams,
      roleTypes: [...new Set(teams.map((t) => t.roleType))],
    };
  });

  return { rows, total, page, pageSize };
}

// ===========================================================================
// Users — cross-platform list + detail
// ===========================================================================

export interface MasterUserRow {
  userId: string;
  name: string;
  email: string;
  roleCodes: string[];
  clubNames: string[];
  status: string;
  lastLoginAt: Date | null;
}

export interface MasterUserFilters extends PageParams {
  search?: string;
  role?: string;
  clubId?: string;
  status?: string;
}

/** Cross-platform user search with role / club / status filters + pagination. */
export async function getMasterUsers(
  ctx: AuthContext,
  filters: MasterUserFilters = {},
): Promise<Paginated<MasterUserRow>> {
  assertMasterAdmin(ctx);
  const { page, pageSize, skip, take } = normalizePage(filters);

  const where: Prisma.UserWhereInput = {};
  // Role and/or club must be satisfied by the SAME active assignment.
  if (filters.role || filters.clubId) {
    where.roleAssignments = {
      some: {
        status: "ACTIVE",
        ...(filters.role ? { role: { code: filters.role } } : {}),
        ...(filters.clubId ? { clubId: filters.clubId } : {}),
      },
    };
  }
  if (filters.status) where.status = filters.status;
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take,
      select: { id: true, name: true, firstName: true, lastName: true, email: true, status: true, lastLoginAt: true },
    }),
  ]);

  const userIds = users.map((u) => u.id);
  const assignments = userIds.length
    ? await prisma.userRoleAssignment.findMany({
        where: { userId: { in: userIds }, status: "ACTIVE" },
        select: { userId: true, role: { select: { code: true } }, club: { select: { name: true } } },
      })
    : [];

  const rolesByUser = new Map<string, Set<string>>();
  const clubsByUser = new Map<string, Set<string>>();
  for (const a of assignments) {
    (rolesByUser.get(a.userId) ?? rolesByUser.set(a.userId, new Set()).get(a.userId)!).add(a.role.code);
    if (a.club) (clubsByUser.get(a.userId) ?? clubsByUser.set(a.userId, new Set()).get(a.userId)!).add(a.club.name);
  }

  const rows: MasterUserRow[] = users.map((u) => ({
    userId: u.id,
    name: u.name?.trim() || `${u.firstName} ${u.lastName}`.trim() || u.email,
    email: u.email,
    roleCodes: [...(rolesByUser.get(u.id) ?? [])],
    clubNames: [...(clubsByUser.get(u.id) ?? [])],
    status: u.status,
    lastLoginAt: u.lastLoginAt,
  }));

  return { rows, total, page, pageSize };
}

export interface MasterUserDetail {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  assignments: { roleCode: string; clubName: string | null; teamName: string | null; status: string }[];
  clubNames: string[];
  notificationPreference: {
    emailEnabled: boolean;
    pushEnabled: boolean;
    smsEnabled: boolean;
    chatNotificationsEnabled: boolean;
    announcementNotificationsEnabled: boolean;
    billingNotificationsEnabled: boolean;
    scheduleNotificationsEnabled: boolean;
  } | null;
  pendingInvitations: { id: string; clubName: string | null; roleCode: string; createdAt: Date }[];
}

export async function getMasterUserDetail(ctx: AuthContext, userId: string): Promise<MasterUserDetail | null> {
  assertMasterAdmin(ctx);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      roleAssignments: {
        where: { status: "ACTIVE" },
        select: {
          status: true,
          role: { select: { code: true } },
          club: { select: { name: true } },
          team: { select: { name: true } },
        },
      },
      notificationPreference: {
        select: {
          emailEnabled: true,
          pushEnabled: true,
          smsEnabled: true,
          chatNotificationsEnabled: true,
          announcementNotificationsEnabled: true,
          billingNotificationsEnabled: true,
          scheduleNotificationsEnabled: true,
        },
      },
    },
  });
  if (!user) return null;

  const pending = await prisma.invitation.findMany({
    where: { email: user.email, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, roleCode: true, createdAt: true, club: { select: { name: true } } },
  });

  const clubNames = [...new Set(user.roleAssignments.map((a) => a.club?.name).filter((n): n is string => !!n))];

  return {
    userId: user.id,
    name: user.name?.trim() || `${user.firstName} ${user.lastName}`.trim() || user.email,
    email: user.email,
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    assignments: user.roleAssignments.map((a) => ({
      roleCode: a.role.code,
      clubName: a.club?.name ?? null,
      teamName: a.team?.name ?? null,
      status: a.status,
    })),
    clubNames,
    notificationPreference: user.notificationPreference,
    pendingInvitations: pending.map((p) => ({
      id: p.id,
      clubName: p.club?.name ?? null,
      roleCode: p.roleCode,
      createdAt: p.createdAt,
    })),
  };
}

// ===========================================================================
// Audit logs — system-wide, joined to actor + club
// ===========================================================================

export interface MasterAuditRow {
  id: string;
  createdAt: Date;
  actorName: string | null;
  clubName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  ipAddress: string | null;
}

export interface MasterAuditFilters extends PageParams {
  dateFrom?: Date;
  dateTo?: Date;
  actorUserId?: string;
  clubId?: string;
  action?: string;
  resourceType?: string;
}

/** System-wide audit log, newest first, with actor + club names resolved. */
export async function getMasterAuditLogs(
  ctx: AuthContext,
  filters: MasterAuditFilters = {},
): Promise<Paginated<MasterAuditRow>> {
  assertMasterAdmin(ctx);
  const { page, pageSize, skip, take } = normalizePage(filters);

  const where: Prisma.AuditLogWhereInput = {};
  if (filters.actorUserId) where.actorUserId = filters.actorUserId;
  if (filters.clubId) where.clubId = filters.clubId;
  if (filters.action?.trim()) where.action = { contains: filters.action.trim(), mode: "insensitive" };
  if (filters.resourceType?.trim()) where.resourceType = { contains: filters.resourceType.trim(), mode: "insensitive" };
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
    if (filters.dateTo) where.createdAt.lte = filters.dateTo;
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        createdAt: true,
        actorUserId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        metadataJson: true,
        ipAddress: true,
        club: { select: { name: true } },
      },
    }),
  ]);

  const actorIds = [...new Set(logs.map((l) => l.actorUserId).filter((x): x is string => !!x))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, firstName: true, lastName: true, email: true } })
    : [];
  const actorById = new Map(actors.map((a) => [a.id, personName(a)]));

  const rows: MasterAuditRow[] = logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt,
    actorName: l.actorUserId ? (actorById.get(l.actorUserId) ?? null) : null,
    clubName: l.club?.name ?? null,
    action: l.action,
    resourceType: l.resourceType,
    resourceId: l.resourceId,
    metadata: l.metadataJson,
    ipAddress: l.ipAddress,
  }));

  return { rows, total, page, pageSize };
}

/** Distinct action / resource-type / actor values for the audit-log filter dropdowns. */
export async function getAuditFilterOptions(
  ctx: AuthContext,
): Promise<{ actions: string[]; resourceTypes: string[]; actors: { id: string; name: string }[] }> {
  assertMasterAdmin(ctx);
  const [actions, resourceTypes, actorRows] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["resourceType"], select: { resourceType: true }, orderBy: { resourceType: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["actorUserId"], where: { actorUserId: { not: null } }, select: { actorUserId: true } }),
  ]);

  const actorIds = actorRows.map((r) => r.actorUserId).filter((x): x is string => !!x);
  const actorUsers = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, firstName: true, lastName: true, email: true } })
    : [];
  const actors = actorUsers.map((u) => ({ id: u.id, name: personName(u) })).sort((a, b) => a.name.localeCompare(b.name));

  return { actions: actions.map((a) => a.action), resourceTypes: resourceTypes.map((r) => r.resourceType), actors };
}

/** Lazy counts for a coach detail drawer: players across their teams + evals authored. */
export async function getMasterCoachDetail(
  ctx: AuthContext,
  userId: string,
): Promise<{ playersOnTeams: number; evaluationsAuthored: number }> {
  assertMasterAdmin(ctx);

  const teamCoaches = await prisma.teamCoach.findMany({
    where: { userId, status: "ACTIVE" },
    select: { teamId: true },
  });
  const teamIds = teamCoaches.map((t) => t.teamId);

  const [memberships, evaluationsAuthored] = await Promise.all([
    teamIds.length
      ? prisma.playerTeamMembership.findMany({
          where: { teamId: { in: teamIds }, status: "ACTIVE" },
          select: { playerId: true },
          distinct: ["playerId"],
        })
      : Promise.resolve([]),
    prisma.playerEvaluation.count({ where: { createdBy: userId } }),
  ]);

  return { playersOnTeams: memberships.length, evaluationsAuthored };
}

// ===========================================================================
// Club admins — list + invite/resend/revoke (orphan-club remediation)
// ===========================================================================

export interface ClubAdminRow {
  /** USER = accepted (active assignment); INVITE = pending invitation. */
  kind: "USER" | "INVITE";
  /** userId for an active admin; invitationId for a pending invite. */
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "PENDING";
}

/** Read the invited name carried on a CLUB_ADMIN invite's jsonb, if any. */
function inviteeName(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const name = `${typeof m.firstName === "string" ? m.firstName : ""} ${
    typeof m.lastName === "string" ? m.lastName : ""
  }`.trim();
  return name || null;
}

/** A club's Club Admins: active (accepted) users ∪ pending CLUB_ADMIN invites. */
export async function getClubAdmins(ctx: AuthContext, clubId: string): Promise<ClubAdminRow[]> {
  assertMasterAdmin(ctx);

  const [assignments, invites] = await Promise.all([
    prisma.userRoleAssignment.findMany({
      where: { clubId, status: "ACTIVE", role: { code: "CLUB_ADMIN" } },
      select: { user: { select: { id: true, name: true, firstName: true, lastName: true, email: true } } },
    }),
    prisma.invitation.findMany({
      where: { clubId, roleCode: "CLUB_ADMIN", status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, linkMetadata: true },
    }),
  ]);

  const usersById = new Map<string, ClubAdminRow>();
  for (const a of assignments) {
    usersById.set(a.user.id, {
      kind: "USER",
      id: a.user.id,
      name: personName(a.user),
      email: a.user.email,
      status: "ACTIVE",
    });
  }
  const inviteRows: ClubAdminRow[] = invites.map((inv) => ({
    kind: "INVITE",
    id: inv.id,
    name: inviteeName(inv.linkMetadata) ?? "Invited admin",
    email: inv.email,
    status: "PENDING",
  }));

  return [...usersById.values(), ...inviteRows];
}

/** Invite an initial or additional CLUB_ADMIN for a club (audited; emails best-effort). */
export async function inviteClubAdmin(
  ctx: AuthContext,
  clubId: string,
  input: ClubAdminInviteInput,
): Promise<{ invitationId: string; acceptUrl: string; emailDelivered: boolean }> {
  assertMasterAdmin(ctx);
  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null }, select: { id: true } });
  if (!club) throw new ForbiddenError("Club not found");

  const email = input.email.trim().toLowerCase();
  const activeAdmin = await prisma.userRoleAssignment.findFirst({
    where: { clubId, status: "ACTIVE", role: { code: "CLUB_ADMIN" }, user: { email } },
    select: { id: true },
  });
  if (activeAdmin) throw new ConflictError("That email is already an active club admin for this club.");
  const pending = await prisma.invitation.findFirst({
    where: { clubId, roleCode: "CLUB_ADMIN", status: "PENDING", email },
    select: { id: true },
  });
  if (pending) throw new ConflictError("A club-admin invite is already pending for that email — use Resend.");

  const meta =
    input.firstName || input.lastName
      ? { firstName: input.firstName ?? null, lastName: input.lastName ?? null }
      : null;
  const res = await createInvitation({
    clubId,
    email,
    roleCode: "CLUB_ADMIN",
    linkMetadata: meta ?? undefined,
    invitedByUserId: ctx.userId,
  });
  await recordAuditStandalone({
    action: "club_admin.invite",
    resourceType: "invitation",
    resourceId: res.id,
    clubId,
    actorUserId: ctx.userId,
    metadata: { email },
  });
  return { invitationId: res.id, acceptUrl: res.acceptUrl, emailDelivered: res.emailDelivered };
}

/** Verify an invitation is a CLUB_ADMIN invite and return its clubId, else throw. */
async function assertClubAdminInvite(invitationId: string): Promise<{ clubId: string | null }> {
  const inv = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: { roleCode: true, clubId: true },
  });
  if (!inv || inv.roleCode !== "CLUB_ADMIN") throw new ForbiddenError("Invitation not found");
  return { clubId: inv.clubId };
}

/** Resend a pending CLUB_ADMIN invite (rotates token; audited). */
export async function resendClubAdminInvite(
  ctx: AuthContext,
  invitationId: string,
): Promise<{ acceptUrl: string; emailDelivered: boolean }> {
  assertMasterAdmin(ctx);
  const { clubId } = await assertClubAdminInvite(invitationId);
  const res = await resendInvitation(invitationId);
  if (!res) throw new ForbiddenError("Invitation not found");
  await recordAuditStandalone({
    action: "club_admin.invite_resend",
    resourceType: "invitation",
    resourceId: invitationId,
    clubId,
    actorUserId: ctx.userId,
  });
  return res;
}

/** Revoke a pending CLUB_ADMIN invite — its link stops working (audited). */
export async function revokeClubAdminInvite(ctx: AuthContext, invitationId: string): Promise<void> {
  assertMasterAdmin(ctx);
  const { clubId } = await assertClubAdminInvite(invitationId);
  const revoked = await revokeInvitation(invitationId);
  if (revoked) {
    await recordAuditStandalone({
      action: "club_admin.invite_revoke",
      resourceType: "invitation",
      resourceId: invitationId,
      clubId,
      actorUserId: ctx.userId,
    });
  }
}

/**
 * Toggle a club between ACTIVE and SUSPENDED (master-only, audited). Archiving
 * remains a separate, soft-deleting action in the clubs module.
 */
export async function setClubStatus(ctx: AuthContext, clubId: string, status: "ACTIVE" | "SUSPENDED") {
  assertMasterAdmin(ctx);
  const club = await prisma.club.findFirst({ where: { id: clubId, deletedAt: null }, select: { id: true } });
  if (!club) throw new ForbiddenError("Club not found");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.club.update({
      where: { id: clubId },
      data: { status, updatedAt: new Date(), updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      action: status === "SUSPENDED" ? "club.suspend" : "club.activate",
      resourceType: "club",
      resourceId: clubId,
      clubId,
      actorUserId: ctx.userId,
      metadata: { status },
    });
    return updated;
  });
}
