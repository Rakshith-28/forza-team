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
import {
  MESSAGE_EDIT_GRACE_MS,
  type AnnouncementAudience,
  type CreateAnnouncementInput,
  type EditMessageInput,
  type PostMessageInput,
  type UpdateAnnouncementInput,
} from "@/modules/comms/schemas";

/**
 * Comms module service layer — the AUTHORITATIVE place for authorization,
 * tenant scoping, and audit for announcements and team chat (BUILD_PLAN §2,
 * RBAC matrix §6.9–6.11). Every function takes the caller's resolved
 * AuthContext and asserts permission + scope before touching tenant data.
 *
 * Realtime: chat is plain request/response. The read/write surface is kept
 * transport-agnostic so a push layer (Pusher/Ably/etc.) can be added later with
 * no schema change; the MVP client simply polls listMessages.
 */

export class ConflictError extends Error {
  readonly code = "CONFLICT";
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

function requireActiveClub(ctx: AuthContext): string {
  if (!ctx.activeClubId) throw new ForbiddenError("No active club in context");
  return ctx.activeClubId;
}

// ===========================================================================
// Announcements
// ===========================================================================

/** Manage (create/edit/publish/archive) requires the right scope for the audience. */
function assertAnnouncementManage(
  ctx: AuthContext,
  target: { clubId: string; teamId?: string | null; audienceType: AnnouncementAudience },
): void {
  if (target.audienceType === "TEAM_ONLY") {
    if (!target.teamId) throw new ForbiddenError("A team is required for a team-only announcement");
    // Coach must be assigned to the team; admins pass at club scope.
    assertCan(ctx, "announcements.publish_team", { clubId: target.clubId, teamId: target.teamId });
  } else {
    // Club-wide / role-wide audiences are admin-only.
    assertCan(ctx, "announcements.publish_club", { clubId: target.clubId });
  }
}

type AnnouncementRow = {
  status: string;
  audienceType: string;
  teamId: string | null;
  createdBy: string | null;
};

/** Pure visibility check mirroring listAnnouncements' filter (used by getAnnouncement). */
export function canViewAnnouncement(ctx: AuthContext, a: AnnouncementRow): boolean {
  const isClubLevel = ctx.role === "MASTER_ADMIN" || ctx.role === "CLUB_ADMIN";
  if (isClubLevel) return true; // admins see everything in their club, drafts included
  // Drafts are only ever visible to their creator (handled above for admins).
  if (a.status !== "PUBLISHED") return a.createdBy === ctx.userId;

  if (ctx.role === "COACH") {
    if (a.audienceType === "CLUB_ALL" || a.audienceType === "COACHES_ONLY") return true;
    if (a.audienceType === "TEAM_ONLY") return a.teamId != null && ctx.coachTeamIds.includes(a.teamId);
    return a.createdBy === ctx.userId; // PLAYERS_ONLY not for coaches unless they authored it
  }
  // PLAYER
  if (a.audienceType === "CLUB_ALL" || a.audienceType === "PLAYERS_ONLY") return true;
  if (a.audienceType === "TEAM_ONLY") return a.teamId != null && ctx.childTeamIds.includes(a.teamId);
  return false; // COACHES_ONLY and drafts are never visible to players
}

export async function listAnnouncements(ctx: AuthContext, clubId: string) {
  assertCan(ctx, "announcements.view", { clubId });

  const where: Prisma.AnnouncementWhereInput = { clubId };
  const isClubLevel = ctx.role === "MASTER_ADMIN" || ctx.role === "CLUB_ADMIN";

  if (!isClubLevel && ctx.role === "COACH") {
    where.OR = [
      { status: "PUBLISHED", audienceType: { in: ["CLUB_ALL", "COACHES_ONLY"] } },
      { status: "PUBLISHED", audienceType: "TEAM_ONLY", teamId: { in: ctx.coachTeamIds } },
      { createdBy: ctx.userId }, // own drafts + own published
    ];
  } else if (!isClubLevel && ctx.role === "PLAYER") {
    where.status = "PUBLISHED";
    where.OR = [
      { audienceType: { in: ["CLUB_ALL", "PLAYERS_ONLY"] } },
      { audienceType: "TEAM_ONLY", teamId: { in: ctx.childTeamIds } },
    ];
  }

  return prisma.announcement.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { status: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    include: { team: { select: { id: true, name: true } } },
  });
}

/** PUBLISHED club announcements visible to a recipient (mirrors listAnnouncements). */
function publishedVisibleWhere(ctx: AuthContext, clubId: string): Prisma.AnnouncementWhereInput {
  const base: Prisma.AnnouncementWhereInput = { clubId, status: "PUBLISHED" };
  if (ctx.role === "MASTER_ADMIN" || ctx.role === "CLUB_ADMIN") return base;
  if (ctx.role === "COACH") {
    return {
      ...base,
      OR: [
        { audienceType: { in: ["CLUB_ALL", "COACHES_ONLY"] } },
        { audienceType: "TEAM_ONLY", teamId: { in: ctx.coachTeamIds } },
      ],
    };
  }
  return {
    ...base,
    OR: [
      { audienceType: { in: ["CLUB_ALL", "PLAYERS_ONLY"] } },
      { audienceType: "TEAM_ONLY", teamId: { in: ctx.childTeamIds } },
    ],
  };
}

/** Count of PUBLISHED club announcements visible to the caller that they haven't read. */
export async function getMyUnreadClubAnnouncementCount(ctx: AuthContext): Promise<number> {
  if (!ctx.activeClubId) return 0;
  const visible = await prisma.announcement.findMany({
    where: publishedVisibleWhere(ctx, ctx.activeClubId),
    select: { id: true },
    take: 200,
  });
  if (visible.length === 0) return 0;
  const read = await prisma.announcementRead.count({
    where: { userId: ctx.userId, announcementId: { in: visible.map((v) => v.id) } },
  });
  return visible.length - read;
}

export interface MyClubAnnouncement {
  id: string;
  title: string;
  body: string;
  audienceType: string;
  pinned: boolean;
  important: boolean;
  publishedAt: Date | null;
  read: boolean;
}

/** Recent PUBLISHED club announcements visible to the caller, pinned then newest, with read state. */
export async function listMyRecentClubAnnouncements(ctx: AuthContext, limit = 10): Promise<MyClubAnnouncement[]> {
  if (!ctx.activeClubId) return [];
  const rows = await prisma.announcement.findMany({
    where: publishedVisibleWhere(ctx, ctx.activeClubId),
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: { id: true, title: true, body: true, audienceType: true, pinned: true, important: true, publishedAt: true },
  });
  if (rows.length === 0) return [];
  const reads = await prisma.announcementRead.findMany({
    where: { userId: ctx.userId, announcementId: { in: rows.map((r) => r.id) } },
    select: { announcementId: true },
  });
  const readSet = new Set(reads.map((r) => r.announcementId));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    audienceType: r.audienceType,
    pinned: r.pinned,
    important: r.important,
    publishedAt: r.publishedAt,
    read: readSet.has(r.id),
  }));
}

/** Mark a club announcement read for the caller (interaction-only; one row per pair). */
export async function markClubAnnouncementRead(ctx: AuthContext, id: string): Promise<void> {
  const a = await prisma.announcement.findUnique({
    where: { id },
    select: { clubId: true, status: true, audienceType: true, teamId: true, createdBy: true },
  });
  if (!a) throw new ForbiddenError("Announcement not found");
  assertClubScope(ctx, a.clubId);
  if (!canViewAnnouncement(ctx, a)) throw new ForbiddenError("Announcement is not available to you");
  await prisma.announcementRead.upsert({
    where: { uq_announcement_read: { announcementId: id, userId: ctx.userId } },
    create: { announcementId: id, userId: ctx.userId, readAt: new Date() },
    update: { readAt: new Date() },
  });
}

export async function getAnnouncement(ctx: AuthContext, id: string) {
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: { team: { select: { id: true, name: true } } },
  });
  if (!announcement) return null;
  assertClubScope(ctx, announcement.clubId);
  if (!canViewAnnouncement(ctx, announcement)) throw new ForbiddenError("Announcement is outside your scope");
  return announcement;
}

export async function createAnnouncement(ctx: AuthContext, clubId: string, input: CreateAnnouncementInput) {
  assertAnnouncementManage(ctx, { clubId, teamId: input.teamId, audienceType: input.audienceType });
  if (input.teamId) await assertTeamInClub(input.teamId, clubId);

  return prisma.announcement.create({
    data: {
      clubId,
      teamId: input.audienceType === "TEAM_ONLY" ? input.teamId : null,
      title: input.title,
      body: input.body,
      audienceType: input.audienceType,
      pinned: input.pinned ?? false,
      important: input.important ?? false,
      status: "DRAFT",
      createdBy: ctx.userId,
    },
  });
}

export async function updateAnnouncement(ctx: AuthContext, id: string, input: UpdateAnnouncementInput) {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw new ForbiddenError("Announcement not found");
  // Must be allowed to manage both the existing scope and the new audience.
  assertAnnouncementManage(ctx, {
    clubId: existing.clubId,
    teamId: existing.teamId,
    audienceType: existing.audienceType as AnnouncementAudience,
  });
  assertAnnouncementManage(ctx, { clubId: existing.clubId, teamId: input.teamId, audienceType: input.audienceType });
  if (input.teamId) await assertTeamInClub(input.teamId, existing.clubId);

  return prisma.announcement.update({
    where: { id },
    data: {
      title: input.title,
      body: input.body,
      audienceType: input.audienceType,
      teamId: input.audienceType === "TEAM_ONLY" ? input.teamId : null,
      pinned: input.pinned ?? false,
      important: input.important ?? false,
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    },
  });
}

export async function publishAnnouncement(ctx: AuthContext, id: string) {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw new ForbiddenError("Announcement not found");
  assertAnnouncementManage(ctx, {
    clubId: existing.clubId,
    teamId: existing.teamId,
    audienceType: existing.audienceType as AnnouncementAudience,
  });

  return prisma.$transaction(async (tx) => {
    const published = await tx.announcement.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date(), updatedAt: new Date(), updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      action: "announcement.publish",
      resourceType: "announcement",
      resourceId: id,
      clubId: existing.clubId,
      actorUserId: ctx.userId,
      metadata: { audienceType: existing.audienceType, teamId: existing.teamId },
    });
    return published;
  });
}

export async function archiveAnnouncement(ctx: AuthContext, id: string) {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw new ForbiddenError("Announcement not found");
  assertAnnouncementManage(ctx, {
    clubId: existing.clubId,
    teamId: existing.teamId,
    audienceType: existing.audienceType as AnnouncementAudience,
  });

  return prisma.$transaction(async (tx) => {
    const archived = await tx.announcement.update({
      where: { id },
      data: { status: "ARCHIVED", updatedAt: new Date(), updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      action: "announcement.archive",
      resourceType: "announcement",
      resourceId: id,
      clubId: existing.clubId,
      actorUserId: ctx.userId,
    });
    return archived;
  });
}

async function assertTeamInClub(teamId: string, clubId: string): Promise<void> {
  const team = await prisma.team.findFirst({ where: { id: teamId, clubId, deletedAt: null }, select: { id: true } });
  if (!team) throw new ForbiddenError("Team does not belong to this club");
}

// ===========================================================================
// Team chat (one TEAM chat per team)
// ===========================================================================

async function loadTeamForScope(teamId: string): Promise<{ clubId: string }> {
  const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null }, select: { clubId: true } });
  if (!team) throw new ForbiddenError("Team not found");
  return team;
}

/** Teams the caller can participate in chat for (their conversation list). */
export async function listChatTeams(ctx: AuthContext) {
  const clubId = requireActiveClub(ctx);
  const where: Prisma.TeamWhereInput = { clubId, deletedAt: null, status: { not: "ARCHIVED" } };
  if (ctx.role === "COACH") where.id = { in: ctx.coachTeamIds };
  else if (ctx.role === "PLAYER") where.id = { in: ctx.childTeamIds };
  return prisma.team.findMany({ where, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** Get the team's chat, creating it on first use. Caller must have view scope. */
export async function getOrCreateTeamChat(ctx: AuthContext, teamId: string) {
  const { clubId } = await loadTeamForScope(teamId);
  assertCan(ctx, "chat.view_team", { clubId, teamId });

  const existing = await prisma.chat.findFirst({ where: { teamId, chatType: "TEAM" } });
  if (existing) return existing;
  return prisma.chat.create({
    data: { clubId, teamId, chatType: "TEAM", status: "ACTIVE", createdBy: ctx.userId },
  });
}

export interface ChatMessageDTO {
  id: string;
  body: string;
  senderUserId: string;
  senderName: string;
  createdAt: string;
  editedAt: string | null;
  attachments: { fileId: string; name: string; url: string }[];
}

export async function listMessages(
  ctx: AuthContext,
  teamId: string,
  opts: { limit?: number } = {},
): Promise<ChatMessageDTO[]> {
  const { clubId } = await loadTeamForScope(teamId);
  assertCan(ctx, "chat.view_team", { clubId, teamId });

  const chat = await prisma.chat.findFirst({ where: { teamId, chatType: "TEAM" }, select: { id: true } });
  if (!chat) return [];

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const rows = await prisma.message.findMany({
    where: { chatId: chat.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      sender: { select: { id: true, name: true, firstName: true, lastName: true } },
      attachments: { include: { file: { select: { id: true, originalName: true } } } },
    },
  });

  return rows
    .reverse()
    .map((m) => ({
      id: m.id,
      body: m.body,
      senderUserId: m.senderUserId,
      senderName: m.sender.name?.trim() || `${m.sender.firstName} ${m.sender.lastName}`.trim(),
      createdAt: m.createdAt.toISOString(),
      editedAt: m.editedAt ? m.editedAt.toISOString() : null,
      attachments: m.attachments.map((a) => ({
        fileId: a.file.id,
        name: a.file.originalName,
        url: `/api/files/${a.file.id}`,
      })),
    }));
}

export async function postMessage(ctx: AuthContext, teamId: string, input: PostMessageInput) {
  const { clubId } = await loadTeamForScope(teamId);
  assertCan(ctx, "chat.send_team", { clubId, teamId });
  const chat = await getOrCreateTeamChat(ctx, teamId);

  // If an attachment is supplied, it must be a chat file the caller owns in this club.
  if (input.fileId) {
    const file = await prisma.file.findUnique({ where: { id: input.fileId }, select: { clubId: true, ownerUserId: true, purpose: true } });
    if (!file || file.clubId !== clubId || file.purpose !== "CHAT_ATTACHMENT" || file.ownerUserId !== ctx.userId) {
      throw new ForbiddenError("Invalid attachment");
    }
  }

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { chatId: chat.id, senderUserId: ctx.userId, body: input.body, messageType: "TEXT" },
    });
    if (input.fileId) {
      await tx.messageAttachment.create({ data: { messageId: message.id, fileId: input.fileId } });
    }
    return message;
  });
}

export async function editOwnMessage(ctx: AuthContext, messageId: string, input: EditMessageInput) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { chat: { select: { teamId: true, clubId: true } } },
  });
  if (!message || message.deletedAt) throw new ForbiddenError("Message not found");
  if (message.senderUserId !== ctx.userId) throw new ForbiddenError("You can only edit your own messages");
  if (Date.now() - message.createdAt.getTime() > MESSAGE_EDIT_GRACE_MS) {
    throw new ForbiddenError("The edit window for this message has passed");
  }
  // Still must be in scope for the team (membership may have changed).
  assertCan(ctx, "chat.send_team", { clubId: message.chat.clubId, teamId: message.chat.teamId ?? undefined });

  return prisma.message.update({
    where: { id: messageId },
    data: { body: input.body, editedAt: new Date() },
  });
}

export async function deleteMessage(ctx: AuthContext, messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { chat: { select: { teamId: true, clubId: true } } },
  });
  if (!message || message.deletedAt) throw new ForbiddenError("Message not found");

  const teamId = message.chat.teamId ?? undefined;
  const isOwnWithinGrace =
    message.senderUserId === ctx.userId && Date.now() - message.createdAt.getTime() <= MESSAGE_EDIT_GRACE_MS;
  const isModerator = (() => {
    try {
      assertCan(ctx, "chat.moderate_team", { clubId: message.chat.clubId, teamId });
      return true;
    } catch {
      return false;
    }
  })();
  if (!isOwnWithinGrace && !isModerator) {
    throw new ForbiddenError("You cannot delete this message");
  }

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
    if (isModerator && message.senderUserId !== ctx.userId) {
      await recordAudit(tx, {
        action: "chat.message_delete",
        resourceType: "message",
        resourceId: messageId,
        clubId: message.chat.clubId,
        actorUserId: ctx.userId,
        metadata: { teamId, senderUserId: message.senderUserId },
      });
    }
    return deleted;
  });
}
