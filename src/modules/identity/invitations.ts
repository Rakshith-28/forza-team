import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/db/client";
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
  invitedByUserId: string;
}

export async function createInvitation(input: CreateInvitationInput) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 3600 * 1000);

  const club = await prisma.club.findUnique({
    where: { id: input.clubId },
    select: { name: true },
  });

  const invitation = await prisma.invitation.create({
    data: {
      clubId: input.clubId,
      email: input.email,
      roleCode: input.roleCode,
      teamId: input.teamId ?? null,
      teamRoleType: input.teamRoleType ?? null,
      tokenHash: hashToken(token),
      expiresAt,
      status: "PENDING",
      createdBy: input.invitedByUserId,
    },
    select: { id: true },
  });

  // Token travels only in the email link; only its hash is stored. The record
  // is already committed above; emailing is best-effort and never throws.
  const url = `${env.BETTER_AUTH_URL}/accept-invite?id=${invitation.id}&token=${token}`;
  const { subject, html, text } = invitationEmail({
    url,
    clubName: club?.name ?? "your club",
    roleLabel: ROLE_LABELS[input.roleCode],
  });
  const { delivered } = await sendEmail({ to: input.email, subject, html, text });

  logger.info("invitation created", {
    invitationId: invitation.id,
    clubId: input.clubId,
    roleCode: input.roleCode,
    emailDelivered: delivered,
  });
  return { id: invitation.id, emailDelivered: delivered };
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
  if (invitation.status !== "PENDING" || invitation.acceptedAt) {
    return { ok: false, error: "already_used" };
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "expired" };
  }

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
    // A COACH invite with an initial team also creates the team_coaches row so
    // the coach lands with that team visible and appears on the Coaches page.
    if (invitation.roleCode === "COACH" && invitation.clubId && invitation.teamId) {
      await tx.teamCoach.upsert({
        where: { teamId_userId: { teamId: invitation.teamId, userId } },
        create: {
          clubId: invitation.clubId,
          teamId: invitation.teamId,
          userId,
          roleType: invitation.teamRoleType ?? "ASSISTANT_COACH",
          status: "ACTIVE",
          createdBy: invitation.createdBy,
        },
        update: { roleType: invitation.teamRoleType ?? "ASSISTANT_COACH", status: "ACTIVE" },
      });
    }
    // A PARENT invite also provisions the parent business profile (parents.user_id
    // is required, so the profile can only exist once the login is created). The
    // admin can then link children to this profile (roster module, Phase 3).
    if (invitation.roleCode === "PARENT" && invitation.clubId) {
      await tx.parent.create({
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
    }
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
