import "server-only";

import { prisma } from "@/db/client";
import { recordAudit, recordAuditStandalone } from "@/lib/audit";
import { assertCan, assertClubScope, ForbiddenError, type AuthContext } from "@/lib/rbac";
import { createInvitation, resendInvitation } from "@/modules/identity/invitations";
import type { CoachFilters, InviteCoachInput, CoachStatus } from "@/modules/coaches/schemas";

/**
 * Coaches module service layer — AUTHORITATIVE for authorization, club scoping,
 * and audit for coach onboarding/listing (RBAC matrix §6.5). Assign/remove reuse
 * the Phase 2 clubs service; this module adds the club-wide coach LIST (active
 * users ∪ pending invites) and the INVITE flow (mirroring "Invite a player account").
 *
 * Management is club-scoped: Master Admin (any club) + Club Admin (own club);
 * Coach/Player have no access. Gated by `teams.manage` (the permission that
 * already governs coach assignment in Phase 2).
 */

export class ConflictError extends Error {
  readonly code = "CONFLICT";
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export interface CoachTeamRef {
  teamId: string;
  teamName: string;
  roleType: string;
}

export interface CoachRow {
  kind: "USER" | "INVITE";
  /** userId for an active coach; invitationId for a pending invite. */
  id: string;
  name: string;
  email: string;
  status: CoachStatus;
  lastLoginAt: Date | null;
  teams: CoachTeamRef[];
}

function displayName(u: { name: string | null; firstName: string; lastName: string; email: string }): string {
  return u.name?.trim() || `${u.firstName} ${u.lastName}`.trim() || u.email;
}

/**
 * Club coaches: active coach users (by COACH role assignment) with their team
 * assignments + role types, UNION pending COACH invitations. Filtered in-memory
 * (small per-club data) by team / status / free-text search.
 */
export async function listCoaches(ctx: AuthContext, clubId: string, filters: CoachFilters = {}): Promise<CoachRow[]> {
  assertCan(ctx, "teams.manage", { clubId });

  const assignments = await prisma.userRoleAssignment.findMany({
    where: { clubId, status: "ACTIVE", role: { code: "COACH" } },
    select: {
      user: {
        select: { id: true, name: true, firstName: true, lastName: true, email: true, status: true, lastLoginAt: true },
      },
    },
  });
  const usersById = new Map<string, (typeof assignments)[number]["user"]>();
  for (const a of assignments) usersById.set(a.user.id, a.user);
  const userIds = [...usersById.keys()];

  const teamCoaches = userIds.length
    ? await prisma.teamCoach.findMany({
        where: { clubId, userId: { in: userIds }, status: "ACTIVE" },
        include: { team: { select: { id: true, name: true } } },
      })
    : [];
  const teamsByUser = new Map<string, CoachTeamRef[]>();
  for (const tc of teamCoaches) {
    const list = teamsByUser.get(tc.userId) ?? [];
    list.push({ teamId: tc.teamId, teamName: tc.team.name, roleType: tc.roleType });
    teamsByUser.set(tc.userId, list);
  }

  const userRows: CoachRow[] = [...usersById.values()].map((u) => ({
    kind: "USER",
    id: u.id,
    name: displayName(u),
    email: u.email,
    status: u.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    lastLoginAt: u.lastLoginAt,
    teams: teamsByUser.get(u.id) ?? [],
  }));

  const invites = await prisma.invitation.findMany({
    where: { clubId, roleCode: "COACH", status: "PENDING" },
    include: { team: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const inviteRows: CoachRow[] = invites.map((inv) => ({
    kind: "INVITE",
    id: inv.id,
    name: "Invited coach",
    email: inv.email,
    status: "PENDING",
    lastLoginAt: null,
    teams: inv.team
      ? [{ teamId: inv.team.id, teamName: inv.team.name, roleType: inv.teamRoleType ?? "ASSISTANT_COACH" }]
      : [],
  }));

  let rows = [...userRows, ...inviteRows];

  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters.team) rows = rows.filter((r) => r.teams.some((t) => t.teamId === filters.team));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }

  // Active users first, then pending; alphabetical within each.
  const rank = (s: CoachStatus) => (s === "ACTIVE" ? 0 : s === "PENDING" ? 1 : 2);
  return rows.sort((a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name));
}

/**
 * Invite a coach by email (mirrors invitePlayerAccountForPlayer). Optionally seeds an initial
 * team + role type, applied on acceptance. Refuses to duplicate an existing club
 * member — the caller should use "Assign to team" instead. Best-effort email
 * (the invitation record is committed regardless).
 */
export async function inviteCoach(ctx: AuthContext, clubId: string, input: InviteCoachInput) {
  assertCan(ctx, "teams.manage", { clubId });

  const existingUser = await prisma.user.findFirst({ where: { email: input.email }, select: { id: true } });
  if (existingUser) {
    const inClub = await prisma.userRoleAssignment.findFirst({
      where: { userId: existingUser.id, clubId, status: "ACTIVE" },
      select: { id: true },
    });
    if (inClub) {
      throw new ConflictError(
        "That email already belongs to a member of this club — use “Assign to team” instead.",
      );
    }
  }

  if (input.teamId) {
    const team = await prisma.team.findFirst({ where: { id: input.teamId, clubId, deletedAt: null }, select: { id: true } });
    if (!team) throw new ForbiddenError("Team does not belong to this club");
  }

  const invitation = await createInvitation({
    clubId,
    email: input.email,
    roleCode: "COACH",
    teamId: input.teamId ?? null,
    teamRoleType: input.roleType ?? null,
    invitedByUserId: ctx.userId,
  });
  await recordAuditStandalone({
    action: "coach.invite",
    resourceType: "invitation",
    resourceId: invitation.id,
    clubId,
    actorUserId: ctx.userId,
    metadata: { email: input.email, teamId: input.teamId ?? null, roleType: input.roleType ?? null },
  });
  return invitation;
}

// ===========================================================================
// Coach deletion (HARD, permanent — deletion-spec §3). A "coach" is a User with
// team_coaches + a COACH role assignment; there is no Coach entity. Deleting a
// coach strips THIS club's coach footprint and revokes access — the User row,
// other-club roles, and any player-account survive.
// ===========================================================================

/** One team a coach is on + whether removing him leaves it coachless. */
export interface CoachTeamImpact {
  teamId: string;
  teamName: string;
  /** True ONLY when zero coaches remain on the team after removal. */
  willBeCoachless: boolean;
  /** A coach who still covers the team (when not coachless), else null. */
  remainingCoachName: string | null;
}

interface TeamCoachLite {
  teamId: string;
  teamName: string;
  userId: string;
  coachName: string;
}

/**
 * Pure impact rule (unit-testable): for each team the target coaches, is there
 * another active coach left? Never reports "coachless" unless zero coaches
 * remain. `teamCoaches` is the full set of active (team, coach) pairs in scope.
 */
export function computeCoachImpact(coachUserId: string, teamCoaches: TeamCoachLite[]): CoachTeamImpact[] {
  const targetTeamIds = [
    ...new Set(teamCoaches.filter((t) => t.userId === coachUserId).map((t) => t.teamId)),
  ];
  return targetTeamIds.map((teamId) => {
    const onTeam = teamCoaches.filter((t) => t.teamId === teamId);
    const others = onTeam.filter((t) => t.userId !== coachUserId);
    return {
      teamId,
      teamName: onTeam[0]?.teamName ?? "",
      willBeCoachless: others.length === 0,
      remainingCoachName: others[0]?.coachName ?? null,
    };
  });
}

function displayUser(u: { name: string | null; firstName: string; lastName: string; email: string }): string {
  return u.name?.trim() || `${u.firstName} ${u.lastName}`.trim() || u.email;
}

/** Per-team impact of removing a coach from the active club (read-only preview). */
export async function getCoachDeletionImpact(ctx: AuthContext, coachUserId: string): Promise<CoachTeamImpact[]> {
  const clubId = ctx.activeClubId;
  if (!clubId) throw new ForbiddenError("No active club");
  assertCan(ctx, "coach.delete", { clubId });
  assertClubScope(ctx, clubId);

  const rows = await prisma.teamCoach.findMany({
    where: { clubId, status: "ACTIVE" },
    select: {
      teamId: true,
      userId: true,
      team: { select: { name: true } },
      user: { select: { name: true, firstName: true, lastName: true, email: true } },
    },
  });
  const teamCoaches: TeamCoachLite[] = rows.map((r) => ({
    teamId: r.teamId,
    teamName: r.team.name,
    userId: r.userId,
    coachName: displayUser(r.user),
  }));
  return computeCoachImpact(coachUserId, teamCoaches);
}

/**
 * HARD-delete a coach from the active club, in ONE transaction (deletion-spec §3):
 * remove all of this club's team_coaches rows (teams survive), deactivate this
 * club's COACH role assignment(s), and — if the login then has zero active roles
 * of ANY kind — kill its sessions (emergent zero-roles ⇒ /no-access). The User
 * row persists; other-club roles and any player-account are untouched. Coach-
 * authored content uses scalar `created_by` (no FK) and is left intact.
 */
export async function deleteCoach(ctx: AuthContext, coachUserId: string): Promise<void> {
  const clubId = ctx.activeClubId;
  if (!clubId) throw new ForbiddenError("No active club");
  assertCan(ctx, "coach.delete", { clubId });
  assertClubScope(ctx, clubId);

  const [user, teamCoaches, coachAssignments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: coachUserId },
      select: { id: true, name: true, firstName: true, lastName: true, email: true },
    }),
    prisma.teamCoach.findMany({
      where: { userId: coachUserId, clubId, status: "ACTIVE" },
      select: { teamId: true, roleType: true, team: { select: { name: true } } },
    }),
    prisma.userRoleAssignment.count({
      where: { userId: coachUserId, clubId, status: "ACTIVE", role: { code: "COACH" } },
    }),
  ]);
  if (!user) throw new ForbiddenError("Coach not found");
  // Must actually be a coach in THIS club (don't let a Club Admin delete arbitrary users).
  if (teamCoaches.length === 0 && coachAssignments === 0) {
    throw new ForbiddenError("That user is not a coach in this club");
  }

  const coachName = displayUser(user);
  const snapshot = {
    coachUserId,
    name: coachName,
    email: user.email,
    teams: teamCoaches.map((tc) => tc.team.name),
    // Coach-attributable history (parallels the team-deletion snapshot).
    affectedCoaches: teamCoaches.map((tc) => ({
      userId: coachUserId,
      name: coachName,
      roleType: tc.roleType,
      teamId: tc.teamId,
      teamName: tc.team.name,
    })),
  };

  await prisma.$transaction(async (tx) => {
    // Clear ALL of this club's coach assignment rows (teams survive).
    await tx.teamCoach.deleteMany({ where: { userId: coachUserId, clubId } });
    // Deactivate this club's COACH role assignment(s) (reuse the Stage-2 pattern).
    await tx.userRoleAssignment.updateMany({
      where: { userId: coachUserId, clubId, status: "ACTIVE", role: { code: "COACH" } },
      data: { status: "INACTIVE" },
    });
    // Revoke access if no active role of ANY kind remains for this login.
    const [assignments, coachRoles] = await Promise.all([
      tx.userRoleAssignment.count({ where: { userId: coachUserId, status: "ACTIVE" } }),
      tx.teamCoach.count({ where: { userId: coachUserId, status: "ACTIVE" } }),
    ]);
    if (assignments + coachRoles === 0) {
      await tx.session.deleteMany({ where: { userId: coachUserId } });
    }
    await recordAudit(tx, {
      action: "coach.delete",
      resourceType: "coach",
      resourceId: coachUserId,
      clubId,
      actorUserId: ctx.userId,
      metadata: { snapshot },
    });
  });
}

// ===========================================================================
// Coach profile (full record + current/past assignment history)
// ===========================================================================

export interface CoachTeamAssignment {
  teamId: string | null;
  teamName: string;
  roleType: string | null;
  /** When the assignment ended (past only). */
  endedAt: Date | null;
  /** True when the team itself was deleted (sourced from the audit snapshot). */
  teamDeleted: boolean;
}

export interface CoachProfile {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  lastLoginAt: Date | null;
  currentTeams: { teamId: string; teamName: string; roleType: string }[];
  pastTeams: CoachTeamAssignment[];
}

interface AffectedCoach {
  userId: string;
  name: string;
  roleType: string | null;
  teamId: string | null;
  teamName: string;
}

/**
 * Full coach profile for the active club: contact + status, CURRENT teams (active
 * team_coaches), and PAST assignments — both ENDED team_coaches for still-live
 * teams and, for DELETED teams, entries reconstructed from the team-deletion
 * audit snapshots' `affectedCoaches`. Returns null if the user isn't a coach in
 * this club. Admin-only (`teams.manage`).
 */
export async function getCoachProfile(ctx: AuthContext, coachUserId: string): Promise<CoachProfile | null> {
  const clubId = ctx.activeClubId;
  if (!clubId) throw new ForbiddenError("No active club");
  assertCan(ctx, "teams.manage", { clubId });
  assertClubScope(ctx, clubId);

  const user = await prisma.user.findUnique({
    where: { id: coachUserId },
    select: { id: true, name: true, firstName: true, lastName: true, email: true, phone: true, status: true, lastLoginAt: true },
  });
  if (!user) return null;

  const teamCoaches = await prisma.teamCoach.findMany({
    where: { userId: coachUserId, clubId },
    select: { teamId: true, roleType: true, status: true, endedAt: true, team: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const hasCoachAssignment = await prisma.userRoleAssignment.count({
    where: { userId: coachUserId, clubId, role: { code: "COACH" } },
  });
  // Not a coach in this club (now or ever) ⇒ no coach profile here.
  if (teamCoaches.length === 0 && hasCoachAssignment === 0) return null;

  const currentTeams = teamCoaches
    .filter((tc) => tc.status === "ACTIVE")
    .map((tc) => ({ teamId: tc.teamId, teamName: tc.team.name, roleType: tc.roleType }));

  const pastLive: CoachTeamAssignment[] = teamCoaches
    .filter((tc) => tc.status !== "ACTIVE")
    .map((tc) => ({ teamId: tc.teamId, teamName: tc.team.name, roleType: tc.roleType, endedAt: tc.endedAt, teamDeleted: false }));

  // Deleted teams: reconstruct from team-deletion audit snapshots (small per club).
  const teamDeletes = await prisma.auditLog.findMany({
    where: { clubId, action: "team.delete" },
    select: { createdAt: true, metadataJson: true },
    orderBy: { createdAt: "desc" },
  });
  const pastDeleted: CoachTeamAssignment[] = [];
  for (const log of teamDeletes) {
    const snap = (log.metadataJson as { snapshot?: { affectedCoaches?: AffectedCoach[] } } | null)?.snapshot;
    if (!Array.isArray(snap?.affectedCoaches)) continue;
    for (const a of snap.affectedCoaches) {
      if (a.userId !== coachUserId) continue;
      pastDeleted.push({ teamId: a.teamId, teamName: a.teamName, roleType: a.roleType, endedAt: log.createdAt, teamDeleted: true });
    }
  }

  return {
    userId: user.id,
    name: displayUser(user),
    email: user.email,
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    currentTeams,
    pastTeams: [...pastLive, ...pastDeleted],
  };
}

/**
 * Regenerate the accept link for a pending COACH invite (rotates the token, so
 * the previous link stops working) and return the fresh URL — for an admin to
 * copy and share manually. Authorized by the same capability as inviting a coach
 * and scoped to the invite's club; returns null if no such invite exists.
 */
export async function resendCoachInvitation(
  ctx: AuthContext,
  invitationId: string,
): Promise<{ acceptUrl: string } | null> {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, roleCode: "COACH", status: "PENDING" },
    select: { id: true, clubId: true },
  });
  if (!invitation || !invitation.clubId) return null;
  assertCan(ctx, "teams.manage", { clubId: invitation.clubId });

  const res = await resendInvitation(invitationId);
  if (!res) return null;
  await recordAuditStandalone({
    action: "coach.invite_resend",
    resourceType: "invitation",
    resourceId: invitationId,
    clubId: invitation.clubId,
    actorUserId: ctx.userId,
  });
  return { acceptUrl: res.acceptUrl };
}
