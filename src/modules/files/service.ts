import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/db/client";
import { recordAudit } from "@/lib/audit";
import { assertCan, assertClubScope, can, ForbiddenError, type AuthContext } from "@/lib/rbac";
import { getStorage } from "@/modules/files/storage";
import { validateUpload, type FilePurpose } from "@/modules/files/schemas";

/**
 * Files module service layer — AUTHORITATIVE for upload validation, storage,
 * tenant/child scope on reads, and audit (BUILD_PLAN §2, RBAC matrix §6.9).
 *
 * Raw storage keys NEVER leave this layer: a player photo / document is exposed
 * to the app as the proxy path `/api/files/{id}`, and that route streams bytes
 * only after re-running the scope check in getFileForDownload().
 */

export interface UploadFileInput {
  bytes: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

function buildKey(clubId: string, ext: string): string {
  return `${clubId}/${randomUUID()}${ext}`;
}

async function persist(
  input: UploadFileInput,
  purpose: FilePurpose,
  clubId: string,
  ownerUserId: string,
  links: { teamId?: string | null; playerId?: string | null } = {},
) {
  const ext = validateUpload(purpose, input);
  const key = buildKey(clubId, ext);
  await getStorage().put({ key, bytes: input.bytes, contentType: input.mimeType });
  return prisma.file.create({
    data: {
      clubId,
      ownerUserId,
      teamId: links.teamId ?? null,
      playerId: links.playerId ?? null,
      storageKey: key,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: BigInt(input.size),
      purpose,
    },
  });
}

// ===========================================================================
// Uploads
// ===========================================================================

/**
 * A player's photo is owned by the family: ONLY a PARENT setting THEIR own
 * linked child's photo may do so. Staff (coaches/admins) hold the broader
 * player-edit permissions, so we gate on role + own-child scope here — they can
 * view the photo on the roster but never set or replace it from the console.
 * Pure (no DB) so the authorization boundary is unit-testable directly.
 */
export function canSetPlayerPhoto(ctx: AuthContext, clubId: string, playerId: string): boolean {
  return ctx.role === "PARENT" && can(ctx, "players.edit_limited_own_child", { clubId, playerId });
}

/** Upload (or replace) a player's photo — parent-own-child only (see canSetPlayerPhoto). */
export async function uploadPlayerPhoto(ctx: AuthContext, playerId: string, input: UploadFileInput) {
  const player = await prisma.player.findFirst({
    where: { id: playerId, deletedAt: null },
    select: { clubId: true },
  });
  if (!player) throw new ForbiddenError("Player not found");

  if (!canSetPlayerPhoto(ctx, player.clubId, playerId)) {
    throw new ForbiddenError("A player's photo can only be set from the player's own account");
  }

  const file = await persist(input, "PLAYER_PHOTO", player.clubId, ctx.userId, { playerId });

  return prisma.$transaction(async (tx) => {
    await tx.player.update({
      where: { id: playerId },
      data: { photoUrl: `/api/files/${file.id}`, updatedAt: new Date(), updatedBy: ctx.userId },
    });
    await recordAudit(tx, {
      action: "file.upload",
      resourceType: "file",
      resourceId: file.id,
      clubId: player.clubId,
      actorUserId: ctx.userId,
      metadata: { purpose: "PLAYER_PHOTO", playerId },
    });
    return file;
  });
}

export async function uploadClubDocument(ctx: AuthContext, clubId: string, input: UploadFileInput) {
  assertCan(ctx, "documents.manage_club", { clubId });
  const file = await persist(input, "CLUB_DOCUMENT", clubId, ctx.userId);
  await recordAudit(prisma, {
    action: "file.upload",
    resourceType: "file",
    resourceId: file.id,
    clubId,
    actorUserId: ctx.userId,
    metadata: { purpose: "CLUB_DOCUMENT", originalName: file.originalName },
  });
  return file;
}

/** Upload a file to attach to a team chat message. Caller must be able to post. */
export async function uploadChatAttachment(ctx: AuthContext, teamId: string, input: UploadFileInput) {
  const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null }, select: { clubId: true } });
  if (!team) throw new ForbiddenError("Team not found");
  assertCan(ctx, "chat.send_team", { clubId: team.clubId, teamId });
  return persist(input, "CHAT_ATTACHMENT", team.clubId, ctx.userId);
}

/** Upload a team-scoped document. Coach (assigned team) or admin (club-wide). */
export async function uploadTeamDocument(ctx: AuthContext, teamId: string, input: UploadFileInput) {
  const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null }, select: { clubId: true } });
  if (!team) throw new ForbiddenError("Team not found");
  assertCan(ctx, "documents.manage_team", { clubId: team.clubId, teamId });
  const file = await persist(input, "TEAM_DOCUMENT", team.clubId, ctx.userId, { teamId });
  await recordAudit(prisma, {
    action: "file.upload",
    resourceType: "file",
    resourceId: file.id,
    clubId: team.clubId,
    actorUserId: ctx.userId,
    metadata: { purpose: "TEAM_DOCUMENT", teamId, originalName: file.originalName },
  });
  return file;
}

/** Team documents for teams the caller can see (admin=club, coach=assigned, parent=child teams). */
export async function listAccessibleTeamDocuments(ctx: AuthContext, clubId: string) {
  assertClubScope(ctx, clubId);
  const where: { clubId: string; purpose: "TEAM_DOCUMENT"; teamId?: { in: string[] } } = {
    clubId,
    purpose: "TEAM_DOCUMENT",
  };
  if (ctx.role === "COACH") where.teamId = { in: ctx.coachTeamIds };
  else if (ctx.role === "PARENT") where.teamId = { in: ctx.childTeamIds };
  // Master/Club admin: all team docs in the club.

  return prisma.file.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      teamId: true,
      team: { select: { id: true, name: true } },
    },
  });
}

export async function deleteTeamDocument(ctx: AuthContext, fileId: string) {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.purpose !== "TEAM_DOCUMENT" || !file.teamId) throw new ForbiddenError("Document not found");
  assertCan(ctx, "documents.manage_team", { clubId: file.clubId, teamId: file.teamId });

  await getStorage().delete(file.storageKey);
  await prisma.$transaction(async (tx) => {
    await tx.file.delete({ where: { id: fileId } });
    await recordAudit(tx, {
      action: "file.delete",
      resourceType: "file",
      resourceId: fileId,
      clubId: file.clubId,
      actorUserId: ctx.userId,
      metadata: { purpose: "TEAM_DOCUMENT", teamId: file.teamId },
    });
  });
}

// ===========================================================================
// Documents listing / deletion
// ===========================================================================

export async function listClubDocuments(ctx: AuthContext, clubId: string) {
  assertCan(ctx, "documents.view", { clubId });
  return prisma.file.findMany({
    where: { clubId, purpose: "CLUB_DOCUMENT" },
    orderBy: { createdAt: "desc" },
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
}

export async function deleteClubDocument(ctx: AuthContext, fileId: string) {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.purpose !== "CLUB_DOCUMENT") throw new ForbiddenError("Document not found");
  assertCan(ctx, "documents.manage_club", { clubId: file.clubId });

  await getStorage().delete(file.storageKey);
  await prisma.$transaction(async (tx) => {
    await tx.file.delete({ where: { id: fileId } });
    await recordAudit(tx, {
      action: "file.delete",
      resourceType: "file",
      resourceId: fileId,
      clubId: file.clubId,
      actorUserId: ctx.userId,
      metadata: { purpose: "CLUB_DOCUMENT" },
    });
  });
}

// ===========================================================================
// Permission-checked download (the proxy reads through this)
// ===========================================================================

export interface DownloadResult {
  bytes: Buffer;
  mimeType: string;
  originalName: string;
}

/**
 * Authorize + fetch a file's bytes for the proxy endpoint. Scope depends on the
 * file's purpose; the storage key is used only to read bytes and is never
 * returned. Throws ForbiddenError when out of scope.
 */
export async function getFileForDownload(ctx: AuthContext, fileId: string): Promise<DownloadResult | null> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) return null;
  assertClubScope(ctx, file.clubId); // tenant boundary (master admin is cross-tenant)

  if (file.purpose === "CLUB_DOCUMENT") {
    assertCan(ctx, "documents.view", { clubId: file.clubId });
  } else if (file.purpose === "TEAM_DOCUMENT") {
    // Viewing a team document follows team visibility (coach=assigned, parent=child team).
    if (!file.teamId) throw new ForbiddenError("File is outside your scope");
    assertCan(ctx, "teams.view", { clubId: file.clubId, teamId: file.teamId });
  } else if (file.purpose === "CHAT_ATTACHMENT") {
    await assertChatAttachmentAccess(ctx, file.id, file.clubId, file.ownerUserId);
  } else if (file.purpose === "PLAYER_PHOTO") {
    await assertPlayerPhotoAccess(ctx, file.playerId, file.clubId, file.ownerUserId);
  } else {
    throw new ForbiddenError("Unsupported file");
  }

  const bytes = await getStorage().get(file.storageKey);
  if (!bytes) return null;
  return { bytes, mimeType: file.mimeType, originalName: file.originalName };
}

async function assertChatAttachmentAccess(
  ctx: AuthContext,
  fileId: string,
  clubId: string,
  ownerUserId: string | null,
): Promise<void> {
  const attachment = await prisma.messageAttachment.findFirst({
    where: { fileId },
    select: { message: { select: { chat: { select: { teamId: true } } } } },
  });
  if (!attachment) {
    // Not yet attached — only the uploader may fetch it.
    if (ownerUserId === ctx.userId) return;
    throw new ForbiddenError("File is outside your scope");
  }
  const teamId = attachment.message.chat.teamId ?? undefined;
  assertCan(ctx, "chat.view_team", { clubId, teamId });
}

async function assertPlayerPhotoAccess(
  ctx: AuthContext,
  playerId: string | null,
  clubId: string,
  ownerUserId: string | null,
): Promise<void> {
  // Direct FK lookup (Phase 5): the photo's owning player is files.player_id.
  if (!playerId) {
    // Freshly uploaded, not yet bound to a player — uploader only.
    if (ownerUserId === ctx.userId) return;
    throw new ForbiddenError("File is outside your scope");
  }
  if (ctx.role === "MASTER_ADMIN" || ctx.role === "CLUB_ADMIN") return; // club scope already asserted
  if (ctx.role === "COACH") {
    if (ctx.coachTeamPlayerIds.includes(playerId)) return;
    throw new ForbiddenError("Player is outside your scope");
  }
  // PARENT — own child always; a teammate's photo only when the club allows it.
  if (ctx.linkedPlayerIds.includes(playerId)) return;
  const onChildTeam = await prisma.playerTeamMembership.findFirst({
    where: { playerId, teamId: { in: ctx.childTeamIds }, status: "ACTIVE" },
    select: { id: true },
  });
  if (onChildTeam) {
    const setting = await prisma.clubSetting.findUnique({
      where: { clubId },
      select: { showPlayerPhotosToParents: true },
    });
    if (setting?.showPlayerPhotosToParents) return;
  }
  throw new ForbiddenError("Photo is outside your scope");
}
