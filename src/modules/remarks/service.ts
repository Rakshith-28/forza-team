import "server-only";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { recordAudit } from "@/lib/audit";
import { assertCan, assertTeamScope, ForbiddenError, type AuthContext } from "@/lib/rbac";
import { getPlayerGuardianUserIds } from "@/modules/roster/service";

import { COACH_REMARK_NOTIFICATION_TYPE, IN_APP_CHANNEL, type AddRemarkInput } from "@/modules/remarks/schemas";

/**
 * Remarks module service layer — the AUTHORITATIVE place for authorization,
 * tenant scoping, and audit for private, player-level coach remarks (one-way:
 * coach → player account). A remark is coach-only until `playerVisible` is turned
 * on, at which point the player's ACTIVE linked guardians get a bell-only
 * Notification (type COACH_REMARK, deliveryChannel IN_APP) — never a club
 * announcement. A PLAYER account only ever sees their own linked children's
 * shared remarks.
 */

type PlayerName = { firstName: string; lastName: string; preferredName: string | null };
const displayName = (p: PlayerName) => p.preferredName ?? `${p.firstName} ${p.lastName}`;

/** Staff-facing remark row (includes visibility — coaches manage it). */
export interface StaffRemark {
  id: string;
  body: string;
  playerVisible: boolean;
  createdAt: Date;
}

/** A team's player with their remark history, for the coach Remarks tab. */
export interface TeamRemarkRow {
  playerId: string;
  name: string;
  remarks: StaffRemark[];
}

/** Player-account-facing group: one linked child and their shared remarks (no visibility flag). */
export interface ChildRemarkGroup {
  playerId: string;
  childName: string;
  remarks: { id: string; body: string; createdAt: Date }[];
}

/** Create one Notification per recipient (bell-only delivery of a shared remark). */
async function fanOutRemarkNotifications(
  tx: Prisma.TransactionClient,
  args: { recipients: string[]; clubId: string; remarkId: string; playerId: string; body: string; childName: string },
): Promise<void> {
  if (args.recipients.length === 0) return;
  await tx.notification.createMany({
    data: args.recipients.map((userId) => ({
      userId,
      clubId: args.clubId,
      type: COACH_REMARK_NOTIFICATION_TYPE,
      title: `New note about ${args.childName}`,
      body: args.body,
      payloadJson: { remarkId: args.remarkId, playerId: args.playerId } as Prisma.InputJsonValue,
      deliveryChannel: IN_APP_CHANNEL,
      status: "SENT",
      sentAt: new Date(),
    })),
  });
}

/**
 * Add a remark to a player. Staff only (admin club-wide, coach assigned-team).
 * If created player-visible, notifies the linked guardians in the same tx.
 */
export async function addPlayerRemark(ctx: AuthContext, input: AddRemarkInput) {
  const player = await prisma.player.findFirst({
    where: { id: input.playerId, deletedAt: null },
    select: { id: true, clubId: true, firstName: true, lastName: true, preferredName: true },
  });
  if (!player) throw new ForbiddenError("Player not found");
  assertCan(ctx, "remarks.manage", { clubId: player.clubId, playerId: player.id });

  return prisma.$transaction(async (tx) => {
    const remark = await tx.playerRemark.create({
      data: {
        clubId: player.clubId,
        playerId: player.id,
        authorUserId: ctx.userId,
        body: input.body,
        playerVisible: input.playerVisible,
        sharedAt: input.playerVisible ? new Date() : null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
    if (input.playerVisible) {
      const recipients = await getPlayerGuardianUserIds(ctx, player.id);
      await fanOutRemarkNotifications(tx, {
        recipients,
        clubId: player.clubId,
        remarkId: remark.id,
        playerId: player.id,
        body: input.body,
        childName: displayName(player),
      });
    }
    await recordAudit(tx, {
      action: "remark.create",
      resourceType: "player_remark",
      resourceId: remark.id,
      clubId: player.clubId,
      actorUserId: ctx.userId,
      metadata: { playerId: player.id, playerVisible: input.playerVisible },
    });
    return remark;
  });
}

/**
 * Flip a remark's player visibility. Sharing for the first time fans out the
 * bell notifications; hiding pulls back any still-unread ones so it leaves the
 * player account's bell. `sharedAt` is set once, so re-sharing never re-notifies.
 */
export async function setRemarkVisibility(ctx: AuthContext, remarkId: string, playerVisible: boolean) {
  const remark = await prisma.playerRemark.findFirst({
    where: { id: remarkId, deletedAt: null },
    select: { id: true, clubId: true, playerId: true, body: true, playerVisible: true, sharedAt: true },
  });
  if (!remark) throw new ForbiddenError("Remark not found");
  assertCan(ctx, "remarks.manage", { clubId: remark.clubId, playerId: remark.playerId });
  if (remark.playerVisible === playerVisible) return remark; // no-op

  return prisma.$transaction(async (tx) => {
    const firstShare = playerVisible && !remark.sharedAt;
    const updated = await tx.playerRemark.update({
      where: { id: remarkId },
      data: {
        playerVisible,
        sharedAt: firstShare ? new Date() : remark.sharedAt,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      },
    });
    if (firstShare) {
      const player = await tx.player.findUnique({
        where: { id: remark.playerId },
        select: { firstName: true, lastName: true, preferredName: true },
      });
      const recipients = await getPlayerGuardianUserIds(ctx, remark.playerId);
      await fanOutRemarkNotifications(tx, {
        recipients,
        clubId: remark.clubId,
        remarkId,
        playerId: remark.playerId,
        body: remark.body,
        childName: player ? displayName(player) : "your player",
      });
    } else if (!playerVisible) {
      await tx.notification.deleteMany({
        where: {
          type: COACH_REMARK_NOTIFICATION_TYPE,
          readAt: null,
          payloadJson: { path: ["remarkId"], equals: remarkId },
        },
      });
    }
    await recordAudit(tx, {
      action: "remark.visibility",
      resourceType: "player_remark",
      resourceId: remarkId,
      clubId: remark.clubId,
      actorUserId: ctx.userId,
      metadata: { playerId: remark.playerId, playerVisible },
    });
    return updated;
  });
}

/** All remarks for a single player, newest first. Staff-scoped. */
export async function listPlayerRemarks(ctx: AuthContext, playerId: string): Promise<StaffRemark[]> {
  const player = await prisma.player.findFirst({
    where: { id: playerId, deletedAt: null },
    select: { id: true, clubId: true },
  });
  if (!player) throw new ForbiddenError("Player not found");
  assertCan(ctx, "remarks.manage", { clubId: player.clubId, playerId });
  return prisma.playerRemark.findMany({
    where: { playerId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, body: true, playerVisible: true, createdAt: true },
  });
}

/** A team's active players each with their remark history — the coach Remarks tab. */
export async function listTeamRemarks(ctx: AuthContext, teamId: string): Promise<TeamRemarkRow[]> {
  const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null }, select: { clubId: true } });
  if (!team) throw new ForbiddenError("Team not found");
  assertTeamScope(ctx, { clubId: team.clubId, teamId });

  const memberships = await prisma.playerTeamMembership.findMany({
    where: { teamId, clubId: team.clubId, status: "ACTIVE" },
    select: { player: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
    orderBy: { player: { lastName: "asc" } },
  });
  const players = memberships.map((m) => m.player);
  if (players.length === 0) return [];

  const remarks = await prisma.playerRemark.findMany({
    where: { playerId: { in: players.map((p) => p.id) }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, playerId: true, body: true, playerVisible: true, createdAt: true },
  });
  const byPlayer = new Map<string, StaffRemark[]>();
  for (const r of remarks) {
    const list = byPlayer.get(r.playerId) ?? [];
    list.push({ id: r.id, body: r.body, playerVisible: r.playerVisible, createdAt: r.createdAt });
    byPlayer.set(r.playerId, list);
  }
  return players.map((p) => ({ playerId: p.id, name: displayName(p), remarks: byPlayer.get(p.id) ?? [] }));
}

/**
 * A PLAYER account's view: their own linked children's SHARED remarks, grouped
 * by child, newest first. Player-safe by construction — restricted to
 * `ctx.linkedPlayerIds` and `playerVisible: true`, so other families' notes are
 * unreachable.
 */
export async function listMyChildRemarks(ctx: AuthContext): Promise<ChildRemarkGroup[]> {
  // Player-safe by construction: `linkedPlayerIds` is the authoritative own-child
  // scope set (built in the context loader), exactly like listLinkedChildren —
  // no other family's player id can appear here.
  if (ctx.linkedPlayerIds.length === 0) return [];

  const [players, remarks] = await Promise.all([
    prisma.player.findMany({
      where: { id: { in: ctx.linkedPlayerIds }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, preferredName: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.playerRemark.findMany({
      where: { playerId: { in: ctx.linkedPlayerIds }, playerVisible: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, playerId: true, body: true, createdAt: true },
    }),
  ]);
  const byPlayer = new Map<string, { id: string; body: string; createdAt: Date }[]>();
  for (const r of remarks) {
    const list = byPlayer.get(r.playerId) ?? [];
    list.push({ id: r.id, body: r.body, createdAt: r.createdAt });
    byPlayer.set(r.playerId, list);
  }
  return players
    .filter((p) => byPlayer.has(p.id))
    .map((p) => ({ playerId: p.id, childName: displayName(p), remarks: byPlayer.get(p.id) ?? [] }));
}

// --- Bell notifications (COACH_REMARK only) --------------------------------

export interface RemarkNotificationItem {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  date: Date;
}

/** Recent coach-remark notifications for the caller, newest first (bell feed). */
export async function listMyRemarkNotifications(ctx: AuthContext, limit = 10): Promise<RemarkNotificationItem[]> {
  const rows = await prisma.notification.findMany({
    where: { userId: ctx.userId, type: COACH_REMARK_NOTIFICATION_TYPE },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, title: true, body: true, readAt: true, createdAt: true },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, body: r.body, read: r.readAt != null, date: r.createdAt }));
}

/** Unread coach-remark notification count for the bell badge. */
export async function countMyUnreadRemarkNotifications(ctx: AuthContext): Promise<number> {
  return prisma.notification.count({
    where: { userId: ctx.userId, type: COACH_REMARK_NOTIFICATION_TYPE, readAt: null },
  });
}

/** Mark a coach-remark notification read — scoped to the caller (can't touch others'). */
export async function markRemarkNotificationRead(ctx: AuthContext, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: ctx.userId, type: COACH_REMARK_NOTIFICATION_TYPE, readAt: null },
    data: { readAt: new Date(), status: "READ" },
  });
}
