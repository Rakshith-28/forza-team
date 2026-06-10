import "server-only";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { recordAudit, recordAuditStandalone } from "@/lib/audit";
import { logger } from "@/lib/logger";
import {
  assertCan,
  assertChildScope,
  assertClubScope,
  assertTeamScope,
  can,
  ForbiddenError,
  type AuthContext,
} from "@/lib/rbac";
import { createInvitation, parseLinkMetadata, resendInvitation } from "@/modules/identity/invitations";
import {
  ownChildView,
  parentSafeRoster,
  type OwnChild,
  type SafePlayer,
} from "@/modules/roster/projections";
import {
  PARENT_EDITABLE_PLAYER_FIELDS,
  type AddMembershipInput,
  type CreatePlayerInput,
  type InviteParentForPlayerInput,
  type LinkParentInput,
  type ParentUpdatePlayerInput,
  type UpdateParentInput,
  type UpdatePlayerInput,
} from "@/modules/roster/schemas";

/**
 * Roster module service layer — the AUTHORITATIVE place for authorization,
 * tenant scoping, the child-safety projections, and audit for players, parents,
 * parent↔child links, and team memberships (BUILD_PLAN §2, RBAC matrix §6.6–6.8).
 *
 * Every function takes the caller's resolved AuthContext and asserts permission
 * + scope BEFORE touching tenant data. Cross-tenant and cross-child access throw
 * ForbiddenError by construction; parents only ever receive safe/own-child
 * projections — restricted fields never leave this layer.
 */

/** Raised on a uniqueness conflict (duplicate link / membership). */
export class ConflictError extends Error {
  readonly code = "CONFLICT";
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Active club for a non-system caller; throws if there's no tenant context. */
function requireActiveClub(ctx: AuthContext): string {
  if (!ctx.activeClubId) throw new ForbiddenError("No active club in context");
  return ctx.activeClubId;
}

// ===========================================================================
// Players — full (admin / coach within scope)
// ===========================================================================

/**
 * Roster list. Admin = whole club. Coach = the players on the ONE team they're
 * currently acting as (active team), never a union across all assigned teams —
 * a coach must never see a merged multi-team roster (cross-team leak). An
 * explicit `opts.teamId` (e.g. event attendance) overrides the active team.
 */
export async function listPlayers(
  ctx: AuthContext,
  clubId: string,
  opts: { teamId?: string } = {},
) {
  assertCan(ctx, "roster.view_full", { clubId, teamId: opts.teamId });

  const where: Prisma.PlayerWhereInput = { clubId, deletedAt: null };

  if (opts.teamId) {
    // A specific team's roster — coaches must be assigned to it.
    assertTeamScope(ctx, { clubId, teamId: opts.teamId });
    where.teamMemberships = { some: { teamId: opts.teamId, status: "ACTIVE" } };
  } else if (ctx.role === "COACH") {
    const activeTeamId = ctx.activeTeamId ?? null;
    if (!activeTeamId) {
      // No active team selected. Degrade to an EMPTY roster — never union across
      // the coach's teams (that re-opens the cross-team leak this guards). The
      // role gate is responsible for forcing a team pick upstream; a coach who
      // holds teams but has no active team here is an unexpected state.
      if (ctx.coachTeamIds.length > 0) {
        logger.warn("coach roster requested with no active team", { userId: ctx.userId, clubId });
      }
      where.id = { in: [] };
    } else {
      // Scope to the active team only; assertTeamScope rejects a tampered team
      // the coach isn't actually assigned to.
      assertTeamScope(ctx, { clubId, teamId: activeTeamId });
      where.teamMemberships = { some: { teamId: activeTeamId, status: "ACTIVE" } };
    }
  }

  return prisma.player.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      teamMemberships: {
        where: { status: "ACTIVE" },
        include: { team: { select: { id: true, name: true } } },
      },
      _count: { select: { parentLinks: { where: { status: "ACTIVE" } } } },
    },
  });
}

/** Full player record + memberships + parent links. Admin / assigned coach only. */
export async function getPlayer(ctx: AuthContext, playerId: string) {
  const player = await prisma.player.findFirst({
    where: { id: playerId, deletedAt: null },
    include: {
      teamMemberships: {
        where: { status: "ACTIVE" },
        include: { team: { select: { id: true, name: true } }, season: { select: { id: true, name: true } } },
      },
      parentLinks: {
        where: { status: "ACTIVE" },
        include: {
          parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
      },
    },
  });
  if (!player) return null;
  assertCan(ctx, "roster.view_full", { clubId: player.clubId, playerId });
  return player;
}

async function assertTeamInClub(teamId: string, clubId: string): Promise<void> {
  const team = await prisma.team.findFirst({ where: { id: teamId, clubId, deletedAt: null }, select: { id: true } });
  if (!team) throw new ForbiddenError("Team does not belong to this club");
}

export async function createPlayer(ctx: AuthContext, clubId: string, input: CreatePlayerInput) {
  // A COACH may only create players placed on one of their assigned teams.
  if (ctx.role === "COACH" && !input.initialTeamId) {
    throw new ForbiddenError("Coaches must place the player on one of their teams");
  }
  assertCan(ctx, "players.create", { clubId, teamId: input.initialTeamId ?? undefined });
  if (input.initialTeamId) await assertTeamInClub(input.initialTeamId, clubId);

  return prisma.$transaction(async (tx) => {
    const player = await tx.player.create({
      data: {
        clubId,
        firstName: input.firstName,
        lastName: input.lastName,
        preferredName: input.preferredName ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        jerseyNumber: input.jerseyNumber ?? null,
        primaryPosition: input.primaryPosition ?? null,
        secondaryPosition: input.secondaryPosition ?? null,
        photoUrl: input.photoUrl ?? null,
        medicalNotes: input.medicalNotes ?? null,
        allergyNotes: input.allergyNotes ?? null,
        emergencyContactName: input.emergencyContactName ?? null,
        emergencyContactPhone: input.emergencyContactPhone ?? null,
        createdBy: ctx.userId,
      },
    });
    if (input.initialTeamId) {
      await tx.playerTeamMembership.create({
        data: {
          clubId,
          playerId: player.id,
          teamId: input.initialTeamId,
          seasonId: input.initialSeasonId ?? null,
          status: "ACTIVE",
          createdBy: ctx.userId,
        },
      });
    }
    await recordAudit(tx, {
      action: "player.create",
      resourceType: "player",
      resourceId: player.id,
      clubId,
      actorUserId: ctx.userId,
      metadata: { initialTeamId: input.initialTeamId ?? null },
    });
    return player;
  });
}

export async function updatePlayer(ctx: AuthContext, playerId: string, input: UpdatePlayerInput) {
  const player = await prisma.player.findFirst({ where: { id: playerId, deletedAt: null } });
  if (!player) throw new ForbiddenError("Player not found");
  assertCan(ctx, "players.edit_full", { clubId: player.clubId, playerId });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.player.update({
      where: { id: playerId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        preferredName: input.preferredName ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        jerseyNumber: input.jerseyNumber ?? null,
        primaryPosition: input.primaryPosition ?? null,
        secondaryPosition: input.secondaryPosition ?? null,
        photoUrl: input.photoUrl ?? null,
        medicalNotes: input.medicalNotes ?? null,
        allergyNotes: input.allergyNotes ?? null,
        emergencyContactName: input.emergencyContactName ?? null,
        emergencyContactPhone: input.emergencyContactPhone ?? null,
        status: input.status,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      },
    });
    await recordAudit(tx, {
      action: "player.update",
      resourceType: "player",
      resourceId: playerId,
      clubId: player.clubId,
      actorUserId: ctx.userId,
    });
    return updated;
  });
}

export async function archivePlayer(ctx: AuthContext, playerId: string) {
  const player = await prisma.player.findFirst({ where: { id: playerId, deletedAt: null } });
  if (!player) throw new ForbiddenError("Player not found");
  assertCan(ctx, "players.edit_full", { clubId: player.clubId, playerId });

  return prisma.$transaction(async (tx) => {
    const archived = await tx.player.update({
      where: { id: playerId },
      data: { status: "ARCHIVED", deletedAt: new Date(), deletedBy: ctx.userId, updatedAt: new Date(), updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      action: "player.archive",
      resourceType: "player",
      resourceId: playerId,
      clubId: player.clubId,
      actorUserId: ctx.userId,
    });
    return archived;
  });
}

// ===========================================================================
// Team memberships (admin = club; coach = assigned teams)
// ===========================================================================

export async function addPlayerToTeam(ctx: AuthContext, input: AddMembershipInput) {
  const player = await prisma.player.findFirst({
    where: { id: input.playerId, deletedAt: null },
    select: { clubId: true },
  });
  if (!player) throw new ForbiddenError("Player not found");
  assertTeamScope(ctx, { clubId: player.clubId, teamId: input.teamId });
  await assertTeamInClub(input.teamId, player.clubId);
  if (input.seasonId) {
    const season = await prisma.season.findFirst({
      where: { id: input.seasonId, clubId: player.clubId },
      select: { id: true },
    });
    if (!season) throw new ForbiddenError("Season does not belong to this club");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const membership = await tx.playerTeamMembership.create({
        data: {
          clubId: player.clubId,
          playerId: input.playerId,
          teamId: input.teamId,
          seasonId: input.seasonId ?? null,
          status: "ACTIVE",
          createdBy: ctx.userId,
        },
      });
      await recordAudit(tx, {
        action: "membership.add",
        resourceType: "player_team_membership",
        resourceId: membership.id,
        clubId: player.clubId,
        actorUserId: ctx.userId,
        metadata: { playerId: input.playerId, teamId: input.teamId, seasonId: input.seasonId ?? null },
      });
      return membership;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("Player is already on that team for the season");
    throw error;
  }
}

export async function removePlayerFromTeam(ctx: AuthContext, membershipId: string) {
  const membership = await prisma.playerTeamMembership.findUnique({ where: { id: membershipId } });
  if (!membership) throw new ForbiddenError("Membership not found");
  assertTeamScope(ctx, { clubId: membership.clubId, teamId: membership.teamId });

  return prisma.$transaction(async (tx) => {
    const removed = await tx.playerTeamMembership.update({
      where: { id: membershipId },
      data: { status: "INACTIVE", leftAt: new Date() },
    });
    await recordAudit(tx, {
      action: "membership.remove",
      resourceType: "player_team_membership",
      resourceId: membershipId,
      clubId: membership.clubId,
      actorUserId: ctx.userId,
      metadata: { playerId: membership.playerId, teamId: membership.teamId },
    });
    return removed;
  });
}

// ===========================================================================
// Parents (admin manage; parents may edit only their own profile)
// ===========================================================================

export async function listParents(ctx: AuthContext, clubId: string) {
  assertCan(ctx, "parents.manage", { clubId });
  return prisma.parent.findMany({
    where: { clubId, status: "ACTIVE" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { _count: { select: { playerLinks: { where: { status: "ACTIVE" } } } } },
  });
}

export async function listPendingParentInvitations(ctx: AuthContext, clubId: string) {
  assertCan(ctx, "parents.manage", { clubId });
  return prisma.invitation.findMany({
    where: { clubId, roleCode: "PARENT", status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, createdAt: true, expiresAt: true },
  });
}

export async function getParent(ctx: AuthContext, parentId: string) {
  const parent = await prisma.parent.findFirst({
    where: { id: parentId, status: "ACTIVE" },
    include: {
      user: { select: { id: true, email: true, name: true } },
      playerLinks: {
        where: { status: "ACTIVE" },
        include: { player: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
      },
    },
  });
  if (!parent) return null;
  // Admin can view any parent in the club; a parent may view only their own.
  if (!(parent.userId === ctx.userId)) assertCan(ctx, "parents.manage", { clubId: parent.clubId });
  else assertClubScope(ctx, parent.clubId);
  return parent;
}

/** The signed-in parent's own business profile in the active club. */
export async function getOwnParentProfile(ctx: AuthContext) {
  if (ctx.role !== "PARENT") throw new ForbiddenError("Only a parent has a parent profile");
  const clubId = requireActiveClub(ctx);
  return prisma.parent.findFirst({
    where: { userId: ctx.userId, clubId, status: "ACTIVE" },
  });
}

export async function updateParent(ctx: AuthContext, parentId: string, input: UpdateParentInput) {
  const parent = await prisma.parent.findFirst({ where: { id: parentId, status: "ACTIVE" } });
  if (!parent) throw new ForbiddenError("Parent not found");
  // A parent may edit only their own profile; admins may edit any in their club.
  if (parent.userId !== ctx.userId) assertCan(ctx, "parents.manage", { clubId: parent.clubId });
  else assertClubScope(ctx, parent.clubId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.parent.update({
      where: { id: parentId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        secondaryPhone: input.secondaryPhone ?? null,
        preferredContactMethod: input.preferredContactMethod ?? null,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        postalCode: input.postalCode ?? null,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      },
    });
    await recordAudit(tx, {
      action: "parent.update",
      resourceType: "parent",
      resourceId: parentId,
      clubId: parent.clubId,
      actorUserId: ctx.userId,
    });
    return updated;
  });
}

// ===========================================================================
// Parent ↔ player links (admin club-wide; coach for assigned teams if allowed)
// ===========================================================================

/**
 * Authorize managing a player's guardians (invite/link/unlink). Admins may do so
 * club-wide; a COACH may do so for a player on one of their assigned teams ONLY
 * when the club's `allow_coach_invite_parents` setting is on. Parents never.
 */
async function assertGuardianManage(ctx: AuthContext, player: { id: string; clubId: string }): Promise<void> {
  if (can(ctx, "parents.manage", { clubId: player.clubId })) return; // Master / Club Admin
  if (ctx.role === "COACH" && ctx.coachTeamPlayerIds.includes(player.id)) {
    const setting = await prisma.clubSetting.findUnique({
      where: { clubId: player.clubId },
      select: { allowCoachInviteParents: true },
    });
    if (setting?.allowCoachInviteParents) return;
    throw new ForbiddenError("Coach parent management is disabled for this club");
  }
  throw new ForbiddenError("You can't manage this player's guardians");
}

/**
 * Invite a parent FOR a specific player (coach or admin). The link metadata rides
 * on the invitation and becomes a player_parent_link on acceptance. Refuses to
 * duplicate an existing club member (link them instead). Best-effort email.
 */
export async function inviteParentForPlayer(ctx: AuthContext, input: InviteParentForPlayerInput) {
  const player = await prisma.player.findFirst({
    where: { id: input.playerId, deletedAt: null },
    select: { id: true, clubId: true },
  });
  if (!player) throw new ForbiddenError("Player not found");
  await assertGuardianManage(ctx, player);

  const existingUser = await prisma.user.findFirst({ where: { email: input.email }, select: { id: true } });
  if (existingUser) {
    const inClub = await prisma.userRoleAssignment.findFirst({
      where: { userId: existingUser.id, clubId: player.clubId, status: "ACTIVE" },
      select: { id: true },
    });
    if (inClub) {
      throw new ConflictError("That email already belongs to a member of this club — use “Link existing parent” instead.");
    }
  }

  const invitation = await createInvitation({
    clubId: player.clubId,
    email: input.email,
    roleCode: "PARENT",
    invitedByUserId: ctx.userId,
    linkMetadata: {
      playerId: input.playerId,
      relationshipType: input.relationshipType,
      isPrimaryGuardian: input.isPrimaryGuardian ?? false,
      canPickup: input.canPickup ?? false,
      canPay: input.canPay ?? true,
    },
  });
  await recordAuditStandalone({
    action: "parent.invite",
    resourceType: "invitation",
    resourceId: invitation.id,
    clubId: player.clubId,
    actorUserId: ctx.userId,
    metadata: { roleCode: "PARENT", email: input.email, playerId: input.playerId },
  });
  return invitation;
}

/**
 * Regenerate the accept link for a pending PARENT invite (rotates the token, so
 * the previous link stops working) and return the fresh URL — for an admin/coach
 * to copy and share manually. Authorized exactly like the original invite
 * (assertGuardianManage on the linked player); returns null if no such invite
 * exists or its linked player is gone.
 */
export async function resendParentInvitation(
  ctx: AuthContext,
  invitationId: string,
): Promise<{ acceptUrl: string } | null> {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, roleCode: "PARENT", status: "PENDING" },
    select: { id: true, clubId: true, linkMetadata: true },
  });
  if (!invitation || !invitation.clubId) return null;

  const link = parseLinkMetadata(invitation.linkMetadata);
  if (!link) return null;
  const player = await prisma.player.findFirst({
    where: { id: link.playerId, clubId: invitation.clubId, deletedAt: null },
    select: { id: true, clubId: true },
  });
  if (!player) return null;
  await assertGuardianManage(ctx, player);

  const res = await resendInvitation(invitationId);
  if (!res) return null;
  await recordAuditStandalone({
    action: "parent.invite_resend",
    resourceType: "invitation",
    resourceId: invitationId,
    clubId: invitation.clubId,
    actorUserId: ctx.userId,
  });
  return { acceptUrl: res.acceptUrl };
}

export interface CoachRosterPreview {
  /** Active players across the coach's assigned teams. */
  count: number;
  /** A handful of avatars (players with a photo first) for the dashboard tile. */
  avatars: { id: string; displayName: string; photoUrl: string | null }[];
}

/**
 * Player count + a few avatars for the coach's assigned teams — feeds the
 * dashboard "Team Roster" tile. Scoped to the players the coach can see
 * (ctx.coachTeamPlayerIds); returns empty when the coach has no teams yet.
 */
export async function getCoachRosterPreview(ctx: AuthContext, clubId: string): Promise<CoachRosterPreview> {
  assertClubScope(ctx, clubId);
  const ids = ctx.coachTeamPlayerIds;
  if (ids.length === 0) return { count: 0, avatars: [] };

  const players = await prisma.player.findMany({
    where: { id: { in: ids }, clubId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, preferredName: true, photoUrl: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  // Surface players who have a photo first so the overlapping stack looks full.
  const ordered = [...players.filter((p) => p.photoUrl), ...players.filter((p) => !p.photoUrl)];
  const avatars = ordered.slice(0, 5).map((p) => ({
    id: p.id,
    displayName: p.preferredName ?? `${p.firstName} ${p.lastName}`,
    photoUrl: p.photoUrl,
  }));
  return { count: players.length, avatars };
}

/** Active guardian links + pending parent invites for a player (admin/coach scoped). */
export async function listPlayerGuardians(ctx: AuthContext, playerId: string) {
  const player = await prisma.player.findFirst({
    where: { id: playerId, deletedAt: null },
    select: { id: true, clubId: true },
  });
  if (!player) throw new ForbiddenError("Player not found");
  assertCan(ctx, "roster.view_full", { clubId: player.clubId, playerId }); // coach assigned / admin

  const [links, pendingInvites] = await Promise.all([
    prisma.playerParentLink.findMany({
      where: { playerId, status: "ACTIVE" },
      include: { parent: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: {
        clubId: player.clubId,
        roleCode: "PARENT",
        status: "PENDING",
        linkMetadata: { path: ["playerId"], equals: playerId },
      },
      select: { id: true, email: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { links, pendingInvites };
}

/**
 * DISTINCT user ids of a player's ACTIVE linked guardians — the recipients when
 * a coach shares a remark. Staff-scoped (admin club-wide, coach assigned-team)
 * so a coach can only resolve guardians for players they're allowed to reach.
 */
export async function getPlayerGuardianUserIds(ctx: AuthContext, playerId: string): Promise<string[]> {
  const player = await prisma.player.findFirst({
    where: { id: playerId, deletedAt: null },
    select: { id: true, clubId: true },
  });
  if (!player) throw new ForbiddenError("Player not found");
  assertCan(ctx, "roster.view_full", { clubId: player.clubId, playerId });

  const links = await prisma.playerParentLink.findMany({
    where: { playerId, status: "ACTIVE", parent: { status: "ACTIVE" } },
    select: { parent: { select: { userId: true } } },
  });
  return [...new Set(links.map((l) => l.parent.userId))];
}

/** Search club parents for the "Link existing parent" picker (query-gated, minimal fields). */
export async function searchClubParents(ctx: AuthContext, clubId: string, query: string) {
  if (!can(ctx, "parents.manage", { clubId })) {
    assertClubScope(ctx, clubId);
    if (ctx.role !== "COACH") throw new ForbiddenError("Not allowed");
    const setting = await prisma.clubSetting.findUnique({
      where: { clubId },
      select: { allowCoachInviteParents: true },
    });
    if (!setting?.allowCoachInviteParents) throw new ForbiddenError("Coach parent management is disabled for this club");
  }
  const q = query.trim();
  if (q.length < 2) return [];
  return prisma.parent.findMany({
    where: {
      clubId,
      status: "ACTIVE",
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 10,
  });
}

export async function linkParentToPlayer(ctx: AuthContext, input: LinkParentInput) {
  const [player, parent] = await Promise.all([
    prisma.player.findFirst({ where: { id: input.playerId, deletedAt: null }, select: { clubId: true } }),
    prisma.parent.findFirst({ where: { id: input.parentId, status: "ACTIVE" }, select: { clubId: true } }),
  ]);
  if (!player) throw new ForbiddenError("Player not found");
  if (!parent) throw new ForbiddenError("Parent not found");
  // Admins link club-wide; coaches may link for assigned-team players when the
  // club allows it (matrix §6.7, gated by allow_coach_invite_parents).
  await assertGuardianManage(ctx, { id: input.playerId, clubId: player.clubId });
  if (parent.clubId !== player.clubId) throw new ForbiddenError("Parent and player belong to different clubs");

  try {
    return await prisma.$transaction(async (tx) => {
      const link = await tx.playerParentLink.create({
        data: {
          clubId: player.clubId,
          playerId: input.playerId,
          parentId: input.parentId,
          relationshipType: input.relationshipType,
          isPrimaryGuardian: input.isPrimaryGuardian ?? false,
          canPickup: input.canPickup ?? false,
          canPay: input.canPay ?? true,
          status: "ACTIVE",
          createdBy: ctx.userId,
        },
      });
      await recordAudit(tx, {
        action: "child.link",
        resourceType: "player_parent_link",
        resourceId: link.id,
        clubId: player.clubId,
        actorUserId: ctx.userId,
        metadata: { playerId: input.playerId, parentId: input.parentId, relationshipType: input.relationshipType },
      });
      return link;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("This parent is already linked to this player");
    throw error;
  }
}

export async function unlinkParentFromPlayer(ctx: AuthContext, linkId: string) {
  const link = await prisma.playerParentLink.findUnique({ where: { id: linkId } });
  if (!link) throw new ForbiddenError("Link not found");
  await assertGuardianManage(ctx, { id: link.playerId, clubId: link.clubId });

  return prisma.$transaction(async (tx) => {
    const removed = await tx.playerParentLink.update({
      where: { id: linkId },
      data: { status: "INACTIVE" },
    });
    await recordAudit(tx, {
      action: "child.unlink",
      resourceType: "player_parent_link",
      resourceId: linkId,
      clubId: link.clubId,
      actorUserId: ctx.userId,
      metadata: { playerId: link.playerId, parentId: link.parentId },
    });
    return removed;
  });
}

// ===========================================================================
// Parent-facing reads (own children + SAFE team roster)
// ===========================================================================

/** All children linked to the signed-in parent, in the approved own-child view. */
export async function listLinkedChildren(ctx: AuthContext): Promise<
  Array<OwnChild & { teams: { id: string; name: string }[] }>
> {
  if (ctx.linkedPlayerIds.length === 0) return [];
  const players = await prisma.player.findMany({
    where: { id: { in: ctx.linkedPlayerIds }, deletedAt: null },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: {
      teamMemberships: {
        where: { status: "ACTIVE" },
        include: { team: { select: { id: true, name: true } } },
      },
    },
  });
  return players.map((p) => ({
    ...ownChildView(p),
    teams: p.teamMemberships.map((m) => ({ id: m.team.id, name: m.team.name })),
  }));
}

/** A single linked child in the approved own-child view (guarded by child scope). */
export async function getOwnChild(
  ctx: AuthContext,
  playerId: string,
): Promise<(OwnChild & { teams: { id: string; name: string }[] }) | null> {
  // Pure linkage guard first — a parent can never reach another family's child.
  assertChildScope(ctx, { clubId: requireActiveClub(ctx), playerId });
  const player = await prisma.player.findFirst({
    where: { id: playerId, deletedAt: null },
    include: {
      teamMemberships: {
        where: { status: "ACTIVE" },
        include: { team: { select: { id: true, name: true } } },
      },
    },
  });
  if (!player) return null;
  return { ...ownChildView(player), teams: player.teamMemberships.map((m) => ({ id: m.team.id, name: m.team.name })) };
}

/**
 * Parent edit of OWN linked child — approved fields only. The linkage is
 * asserted purely (before any DB read), then ONLY the whitelisted fields are
 * applied; anything else is dropped server-side regardless of input.
 */
export async function updateOwnChild(ctx: AuthContext, playerId: string, input: ParentUpdatePlayerInput) {
  assertChildScope(ctx, { clubId: requireActiveClub(ctx), playerId });

  // Build the update strictly from the whitelist — never from arbitrary keys.
  const data: Prisma.PlayerUpdateInput = {};
  for (const field of PARENT_EDITABLE_PLAYER_FIELDS) {
    if (field in input) {
      data[field] = (input as Record<string, unknown>)[field] as never;
    }
  }

  const player = await prisma.player.findFirst({ where: { id: playerId, deletedAt: null }, select: { clubId: true } });
  if (!player) throw new ForbiddenError("Player not found");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.player.update({
      where: { id: playerId },
      data: { ...data, updatedAt: new Date(), updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      action: "child.update_by_parent",
      resourceType: "player",
      resourceId: playerId,
      clubId: player.clubId,
      actorUserId: ctx.userId,
      metadata: { fields: Object.keys(data) },
    });
    return updated;
  });
}

/**
 * SAFE roster of a team the parent's linked child is on (matrix §6.8). The team
 * must be one of the parent's child-team contexts; every player is run through
 * the parent-safe projection so restricted PII never leaves the server.
 */
export async function listSafeTeamRoster(ctx: AuthContext, teamId: string): Promise<SafePlayer[]> {
  const clubId = requireActiveClub(ctx);
  // A parent may only view rosters of teams their children belong to.
  if (ctx.role === "PARENT" && !ctx.childTeamIds.includes(teamId)) {
    throw new ForbiddenError("Team is outside your children's roster scope");
  }
  assertClubScope(ctx, clubId);

  const [setting, memberships] = await Promise.all([
    prisma.clubSetting.findUnique({ where: { clubId }, select: { showPlayerPhotosToParents: true } }),
    prisma.playerTeamMembership.findMany({
      where: { teamId, clubId, status: "ACTIVE" },
      select: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            jerseyNumber: true,
            primaryPosition: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { player: { lastName: "asc" } },
    }),
  ]);

  return parentSafeRoster(
    memberships.map((m) => m.player),
    { showPhotos: setting?.showPlayerPhotosToParents ?? false },
  );
}
