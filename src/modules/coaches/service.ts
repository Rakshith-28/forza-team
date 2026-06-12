import "server-only";

import { prisma } from "@/db/client";
import { recordAuditStandalone } from "@/lib/audit";
import { assertCan, ForbiddenError, type AuthContext } from "@/lib/rbac";
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
