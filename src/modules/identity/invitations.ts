import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/db/client";
import { Prisma } from "@/db/generated/client";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { invitationEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles";

/**
 * Invitation service (our own — we do NOT use Better Auth's org-plugin invites).
 *
 * Flow: an admin/coach creates an invitation (token hashed at rest, emailed as a
 * link). The recipient accepts by setting a password; we create the Better Auth
 * user (identity) and the `user_role_assignment` (authorization scope) together,
 * then mark the invitation accepted. Sensitive — should be audited (Phase 1
 * leaves an audit hook TODO).
 */

const TOKEN_BYTES = 32;
const EXPIRY_HOURS = 72;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Narrow the invitation's jsonb link_metadata back to PlayerLinkMetadata. */
export function parseLinkMetadata(value: unknown): PlayerLinkMetadata | null {
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;
  if (typeof m.playerId !== "string" || typeof m.relationshipType !== "string") return null;
  return {
    playerId: m.playerId,
    relationshipType: m.relationshipType,
    isPrimaryGuardian: m.isPrimaryGuardian === true,
    canPickup: m.canPickup === true,
    canPay: m.canPay !== false,
  };
}

/** The default team_coaches role_type when a COACH invite carries no explicit one. */
export const DEFAULT_TEAM_ROLE_TYPE = "ASSISTANT_COACH";

/** Lifecycle gate for accepting an invitation (pure — no token/DB). */
export function invitationState(
  inv: { status: string; acceptedAt: Date | null; expiresAt: Date },
  now: Date = new Date(),
): "ok" | "already_used" | "expired" {
  if (inv.status !== "PENDING" || inv.acceptedAt) return "already_used";
  if (inv.expiresAt.getTime() < now.getTime()) return "expired";
  return "ok";
}

export interface InvitationGrantSource {
  roleCode: string;
  clubId: string | null;
  teamId: string | null;
  teamRoleType: string | null;
  linkMetadata: unknown;
}

export interface InvitationGrants {
  /** team_coaches role_type to create for a COACH invite with an initial team, else null. */
  teamCoachRoleType: string | null;
  /** player_account_link to create for a PLAYER invite carrying link metadata, else null. */
  playerLink: PlayerLinkMetadata | null;
}

/**
 * Pure decision: what grants an accepted invitation should produce. Decoupled
 * from Better Auth + the DB so it is unit-testable directly (the seam that
 * blocked a full accept→link unit test). acceptInvitation applies the result.
 */
export function planInvitationGrants(inv: InvitationGrantSource): InvitationGrants {
  const teamCoachRoleType =
    inv.roleCode === "COACH" && inv.clubId && inv.teamId
      ? inv.teamRoleType ?? DEFAULT_TEAM_ROLE_TYPE
      : null;
  const playerLink = inv.roleCode === "PLAYER" && inv.clubId ? parseLinkMetadata(inv.linkMetadata) : null;
  return { teamCoachRoleType, playerLink };
}

/** Fields applyInvitationGrants needs from the invitation row. */
export type InvitationForGrants = InvitationGrantSource & { createdBy: string | null };

/**
 * Apply an accepted invitation's grants within a transaction: create the
 * team_coaches row (COACH + initial team) and/or the player_account_link
 * (PLAYER + link metadata, player account already created). A link to a missing
 * player is skipped GRACEFULLY (no orphan/partial write). Separated from Better
 * Auth so it is integration-testable directly with a real tx.
 */
export async function applyInvitationGrants(
  tx: Prisma.TransactionClient,
  args: { invitation: InvitationForGrants; userId: string; playerAccountId?: string },
): Promise<{ teamCoach: boolean; playerLink: boolean }> {
  const { invitation: inv, userId, playerAccountId } = args;
  const grants = planInvitationGrants(inv);
  let teamCoach = false;
  let playerLink = false;

  if (grants.teamCoachRoleType && inv.clubId && inv.teamId) {
    await tx.teamCoach.upsert({
      where: { teamId_userId: { teamId: inv.teamId, userId } },
      create: {
        clubId: inv.clubId,
        teamId: inv.teamId,
        userId,
        roleType: grants.teamCoachRoleType,
        status: "ACTIVE",
        createdBy: inv.createdBy,
      },
      update: { roleType: grants.teamCoachRoleType, status: "ACTIVE" },
    });
    teamCoach = true;
  }

  if (grants.playerLink && playerAccountId && inv.clubId) {
    const player = await tx.player.findFirst({
      where: { id: grants.playerLink.playerId, clubId: inv.clubId, deletedAt: null },
      select: { id: true },
    });
    if (player) {
      await tx.playerAccountLink.upsert({
        where: { uq_player_account_link: { playerId: grants.playerLink.playerId, playerAccountId } },
        create: {
          clubId: inv.clubId,
          playerId: grants.playerLink.playerId,
          playerAccountId,
          relationshipType: grants.playerLink.relationshipType,
          isPrimaryGuardian: grants.playerLink.isPrimaryGuardian,
          canPickup: grants.playerLink.canPickup,
          canPay: grants.playerLink.canPay,
          status: "ACTIVE",
          createdBy: inv.createdBy,
        },
        update: { status: "ACTIVE" },
      });
      playerLink = true;
    }
  }

  return { teamCoach, playerLink };
}

function tokenMatches(token: string, hash: string): boolean {
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface CreateInvitationInput {
  clubId: string;
  email: string;
  roleCode: Role;
  teamId?: string | null;
  /** For a COACH invite with an initial team: the team_coaches role_type to apply on accept. */
  teamRoleType?: string | null;
  /**
   * For a PLAYER invite carrying a child link: applied as a player_account_link on
   * accept. Also reused as generic jsonb for other roles (e.g. a CLUB_ADMIN invite
   * carries `{ firstName, lastName }` for display in the pending-admin list).
   */
  linkMetadata?: PlayerLinkMetadata | Record<string, unknown> | null;
  invitedByUserId: string;
}

/** Account↔player link carried on a PLAYER invite, applied on acceptance. */
export interface PlayerLinkMetadata {
  playerId: string;
  relationshipType: string;
  isPrimaryGuardian: boolean;
  canPickup: boolean;
  canPay: boolean;
}

/** Build the invitation row payload + the raw token (hashed at rest). */
function prepareInvitationData(input: CreateInvitationInput): {
  token: string;
  data: Prisma.InvitationUncheckedCreateInput;
} {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 3600 * 1000);
  return {
    token,
    data: {
      clubId: input.clubId,
      email: input.email,
      roleCode: input.roleCode,
      teamId: input.teamId ?? null,
      teamRoleType: input.teamRoleType ?? null,
      linkMetadata: input.linkMetadata
        ? (input.linkMetadata as unknown as Prisma.InputJsonValue)
        : undefined,
      tokenHash: hashToken(token),
      expiresAt,
      status: "PENDING",
      createdBy: input.invitedByUserId,
    },
  };
}

/** The accept URL the recipient clicks. The raw token lives ONLY in this link. */
export function buildAcceptUrl(invitationId: string, token: string): string {
  return `${env.BETTER_AUTH_URL}/accept-invite?id=${invitationId}&token=${token}`;
}

/** Best-effort invitation email (never throws). Returns whether it was delivered. */
export async function sendInvitationEmail(params: {
  to: string;
  url: string;
  clubName: string;
  roleCode: Role;
}): Promise<{ delivered: boolean }> {
  const { subject, html, text } = invitationEmail({
    url: params.url,
    clubName: params.clubName,
    roleLabel: ROLE_LABELS[params.roleCode],
  });
  return sendEmail({ to: params.to, subject, html, text });
}

/**
 * Create an invitation row INSIDE an existing transaction (no email send). Lets a
 * caller mint a club + its initial admin invite atomically; the caller is
 * responsible for sending the email AFTER the tx commits (use buildAcceptUrl +
 * sendInvitationEmail). Returns the raw token so the URL can be built.
 */
export async function createInvitationInTx(
  tx: Prisma.TransactionClient,
  input: CreateInvitationInput,
): Promise<{ id: string; token: string }> {
  const { token, data } = prepareInvitationData(input);
  const invitation = await tx.invitation.create({ data, select: { id: true } });
  return { id: invitation.id, token };
}

export async function createInvitation(
  input: CreateInvitationInput,
): Promise<{ id: string; emailDelivered: boolean; acceptUrl: string }> {
  const { token, data } = prepareInvitationData(input);
  const club = await prisma.club.findUnique({ where: { id: input.clubId }, select: { name: true } });
  const invitation = await prisma.invitation.create({ data, select: { id: true } });

  // Token travels only in the email link; only its hash is stored. The record
  // is already committed above; emailing is best-effort and never throws.
  const acceptUrl = buildAcceptUrl(invitation.id, token);
  const { delivered } = await sendInvitationEmail({
    to: input.email,
    url: acceptUrl,
    clubName: club?.name ?? "your club",
    roleCode: input.roleCode,
  });

  logger.info("invitation created", {
    invitationId: invitation.id,
    clubId: input.clubId,
    roleCode: input.roleCode,
    emailDelivered: delivered,
  });
  return { id: invitation.id, emailDelivered: delivered, acceptUrl };
}

/**
 * Resend a pending invitation: rotates the token (invalidating the old link),
 * extends expiry, and re-sends the email. Returns the fresh accept URL +
 * delivery flag, or null if the invitation no longer exists.
 */
export async function resendInvitation(
  invitationId: string,
): Promise<{ acceptUrl: string; emailDelivered: boolean } | null> {
  const inv = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!inv) return null;

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 3600 * 1000);
  await prisma.invitation.update({
    where: { id: invitationId },
    data: { tokenHash: hashToken(token), expiresAt, status: "PENDING", acceptedAt: null, acceptedByUserId: null },
  });

  const acceptUrl = buildAcceptUrl(invitationId, token);
  const club = inv.clubId ? await prisma.club.findUnique({ where: { id: inv.clubId }, select: { name: true } }) : null;
  const { delivered } = await sendInvitationEmail({
    to: inv.email,
    url: acceptUrl,
    clubName: club?.name ?? "your club",
    roleCode: inv.roleCode as Role,
  });
  logger.info("invitation resent", { invitationId, emailDelivered: delivered });
  return { acceptUrl, emailDelivered: delivered };
}

/**
 * Revoke a pending invitation — its link stops working (invitationState treats a
 * non-PENDING status as already-used). Returns whether a pending row was revoked.
 */
export async function revokeInvitation(invitationId: string): Promise<boolean> {
  const result = await prisma.invitation.updateMany({
    where: { id: invitationId, status: "PENDING" },
    data: { status: "REVOKED" },
  });
  return result.count > 0;
}

export interface AcceptInvitationInput {
  invitationId: string;
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
}

export type AcceptResult =
  | { ok: true; userId: string }
  | { ok: false; error: "invalid" | "expired" | "already_used" | "signup_failed" };

export async function acceptInvitation(input: AcceptInvitationInput): Promise<AcceptResult> {
  const invitation = await prisma.invitation.findUnique({
    where: { id: input.invitationId },
  });

  if (!invitation || !tokenMatches(input.token, invitation.tokenHash)) {
    return { ok: false, error: "invalid" };
  }
  const state = invitationState(invitation);
  if (state === "already_used") return { ok: false, error: "already_used" };
  if (state === "expired") return { ok: false, error: "expired" };

  // 1) Identity — create the Better Auth user (password stored in `accounts`).
  let userId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: invitation.email,
        password: input.password,
        name: `${input.firstName} ${input.lastName}`,
        firstName: input.firstName,
        lastName: input.lastName,
        ...(input.phone ? { phone: input.phone } : {}),
      },
    });
    userId = result.user.id;
  } catch (error) {
    logger.error("invitation signup failed", { invitationId: invitation.id, error });
    return { ok: false, error: "signup_failed" };
  }

  // 2) Authorization — role assignment (+ accept the invitation) atomically.
  const role = await prisma.role.findUnique({ where: { code: invitation.roleCode } });
  if (!role) return { ok: false, error: "invalid" };

  await prisma.$transaction(async (tx) => {
    await tx.userRoleAssignment.create({
      data: {
        userId,
        roleId: role.id,
        clubId: invitation.clubId,
        teamId: invitation.teamId,
        isPrimary: true,
        status: "ACTIVE",
        createdBy: invitation.createdBy,
      },
    });
    // A PLAYER invite also provisions the player-account profile
    // (player_accounts.user_id is required, so the profile can only exist once the
    // login is created). The admin can then link player profiles to this account
    // (roster module, Phase 3).
    let playerAccountId: string | undefined;
    if (invitation.roleCode === "PLAYER" && invitation.clubId) {
      const account = await tx.playerAccount.create({
        data: {
          clubId: invitation.clubId,
          userId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: invitation.email,
          phone: input.phone ?? null,
          status: "ACTIVE",
          createdBy: invitation.createdBy,
        },
      });
      playerAccountId = account.id;
    }
    // Apply the planned grants (COACH → team_coaches; PLAYER-with-link →
    // player_account_link). Decoupled + integration-tested in applyInvitationGrants.
    await applyInvitationGrants(tx, { invitation, userId, playerAccountId });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedByUserId: userId },
    });
    // Audit the role grant (sensitive — RBAC matrix §11.6).
    await recordAudit(tx, {
      action: "role.grant",
      resourceType: "user_role_assignment",
      resourceId: userId,
      clubId: invitation.clubId,
      actorUserId: userId,
      metadata: { roleCode: invitation.roleCode, viaInvitation: invitation.id, teamId: invitation.teamId },
    });
  });

  logger.info("invitation accepted", { invitationId: invitation.id, userId });
  return { ok: true, userId };
}
