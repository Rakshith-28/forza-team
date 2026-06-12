"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUserAndContext } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import type { FormState } from "@/modules/roster/action-state";
import {
  ConflictError,
  addPlayerToTeam,
  createPlayer,
  deletePlayer,
  invitePlayerAccountForPlayer,
  linkPlayerAccountToPlayer,
  removePlayerFromTeam,
  resendPlayerAccountInvitation,
  searchClubPlayerAccounts,
  unlinkPlayerAccountFromPlayer,
  updateOwnChild,
  updatePlayerAccount,
  updatePlayer,
} from "@/modules/roster/service";
import {
  addMembershipSchema,
  createPlayerSchema,
  invitePlayerAccountForPlayerSchema,
  linkPlayerAccountSchema,
  playerAccountUpdatePlayerSchema,
  updatePlayerAccountSchema,
  updatePlayerSchema,
} from "@/modules/roster/schemas";

function failZod(error: z.ZodError): FormState {
  return { ok: false, error: error.issues[0]?.message ?? "Invalid input" };
}

function failService(error: unknown): FormState {
  if (error instanceof ForbiddenError) return { ok: false, error: "You don't have access to do that." };
  if (error instanceof ConflictError) return { ok: false, error: error.message };
  throw error; // unexpected — let the error boundary handle it
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
function optStr(fd: FormData, key: string): string | undefined {
  const v = str(fd, key).trim();
  return v.length > 0 ? v : undefined;
}
function bool(fd: FormData, key: string): boolean {
  return fd.get(key) != null;
}

async function activeClub() {
  const { ctx } = await requireUserAndContext();
  return { ctx, clubId: ctx.activeClubId };
}

// --- Players ---------------------------------------------------------------
export async function createPlayerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx, clubId } = await activeClub();
  if (!clubId) return { ok: false, error: "No active club." };
  const parsed = createPlayerSchema.safeParse({
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    preferredName: optStr(fd, "preferredName"),
    dateOfBirth: optStr(fd, "dateOfBirth"),
    jerseyNumber: optStr(fd, "jerseyNumber"),
    primaryPosition: str(fd, "primaryPosition"),
    secondaryPosition: str(fd, "secondaryPosition"),
    emergencyContactName: optStr(fd, "emergencyContactName"),
    emergencyContactPhone: optStr(fd, "emergencyContactPhone"),
    medicalNotes: optStr(fd, "medicalNotes"),
    allergyNotes: optStr(fd, "allergyNotes"),
    initialTeamId: optStr(fd, "initialTeamId") ?? null,
  });
  if (!parsed.success) return failZod(parsed.error);
  let playerId: string;
  try {
    const player = await createPlayer(ctx, clubId, parsed.data);
    playerId = player.id;
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/players");
  redirect(`/players/${playerId}`);
}

export async function updatePlayerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  const parsed = updatePlayerSchema.safeParse({
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    preferredName: optStr(fd, "preferredName"),
    dateOfBirth: optStr(fd, "dateOfBirth"),
    jerseyNumber: optStr(fd, "jerseyNumber"),
    primaryPosition: str(fd, "primaryPosition"),
    secondaryPosition: str(fd, "secondaryPosition"),
    emergencyContactName: optStr(fd, "emergencyContactName"),
    emergencyContactPhone: optStr(fd, "emergencyContactPhone"),
    medicalNotes: optStr(fd, "medicalNotes"),
    allergyNotes: optStr(fd, "allergyNotes"),
    status: str(fd, "status"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await updatePlayer(ctx, playerId, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
  return { ok: true, error: null };
}

/** HARD, permanent player deletion (CLUB_ADMIN only). Typed-name gate is the UI control. */
export async function deletePlayerAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  await deletePlayer(ctx, str(fd, "playerId"));
  revalidatePath("/players");
  redirect("/players");
}

// --- Team memberships ------------------------------------------------------
export async function addMembershipAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  const parsed = addMembershipSchema.safeParse({
    playerId,
    teamId: str(fd, "teamId"),
    seasonId: optStr(fd, "seasonId") ?? null,
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await addPlayerToTeam(ctx, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/players/${playerId}`);
  return { ok: true, error: null };
}

export async function removeMembershipAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  await removePlayerFromTeam(ctx, str(fd, "membershipId"));
  revalidatePath(`/players/${playerId}`);
}

/**
 * Assign a teamless player to a team from the "Unassigned / No team" section
 * (admin: chosen team) or the coach add-player picker (their active team).
 * `addPlayerToTeam` enforces team scope + club membership.
 */
export async function assignTeamlessPlayerAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  const teamId = str(fd, "teamId");
  if (!playerId || !teamId) return;
  await addPlayerToTeam(ctx, { playerId, teamId, seasonId: null });
  revalidatePath("/players");
}

// --- Player accounts -------------------------------------------------------
// NOTE: There is no standalone "invite a player account" action. Player account
// invites are always child-linked and created from a player's roster (see
// inviteGuardianAction below); the player account + player_account_link are
// provisioned together on acceptance.
export async function updatePlayerAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const playerAccountId = str(fd, "playerAccountId");
  const parsed = updatePlayerAccountSchema.safeParse({
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    phone: optStr(fd, "phone"),
    secondaryPhone: optStr(fd, "secondaryPhone"),
    preferredContactMethod: str(fd, "preferredContactMethod"),
    addressLine1: optStr(fd, "addressLine1"),
    addressLine2: optStr(fd, "addressLine2"),
    city: optStr(fd, "city"),
    state: optStr(fd, "state"),
    postalCode: optStr(fd, "postalCode"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await updatePlayerAccount(ctx, playerAccountId, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/player-accounts");
  revalidatePath(`/player-accounts/${playerAccountId}`);
  revalidatePath("/profile");
  return { ok: true, error: null };
}

// --- Player account ↔ player links -----------------------------------------
export async function linkPlayerAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const playerAccountId = str(fd, "playerAccountId");
  const parsed = linkPlayerAccountSchema.safeParse({
    playerId: str(fd, "playerId"),
    playerAccountId,
    relationshipType: str(fd, "relationshipType"),
    isPrimaryGuardian: bool(fd, "isPrimaryGuardian"),
    canPickup: bool(fd, "canPickup"),
    canPay: bool(fd, "canPay"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await linkPlayerAccountToPlayer(ctx, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/player-accounts/${playerAccountId}`);
  revalidatePath(`/players/${parsed.data.playerId}`);
  return { ok: true, error: null };
}

export async function unlinkPlayerAccountAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  const playerAccountId = str(fd, "playerAccountId");
  await unlinkPlayerAccountFromPlayer(ctx, str(fd, "linkId"));
  revalidatePath(`/player-accounts/${playerAccountId}`);
}

// --- Player guardians (coach/admin, from the player detail page) -----------
export async function inviteGuardianAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  const parsed = invitePlayerAccountForPlayerSchema.safeParse({
    email: str(fd, "email"),
    playerId,
    relationshipType: str(fd, "relationshipType"),
    isPrimaryGuardian: bool(fd, "isPrimaryGuardian"),
    canPickup: bool(fd, "canPickup"),
    canPay: bool(fd, "canPay"),
  });
  if (!parsed.success) return failZod(parsed.error);
  let emailDelivered = true;
  let acceptUrl: string;
  try {
    const result = await invitePlayerAccountForPlayer(ctx, parsed.data);
    emailDelivered = result.emailDelivered;
    acceptUrl = result.acceptUrl;
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/players/${playerId}`);
  return {
    ok: true,
    error: null,
    acceptUrl,
    notice: emailDelivered
      ? null
      : "Invitation created, but the email couldn't be sent. Share the invite link below.",
  };
}

export async function linkGuardianAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  const parsed = linkPlayerAccountSchema.safeParse({
    playerId,
    playerAccountId: str(fd, "playerAccountId"),
    relationshipType: str(fd, "relationshipType"),
    isPrimaryGuardian: bool(fd, "isPrimaryGuardian"),
    canPickup: bool(fd, "canPickup"),
    canPay: bool(fd, "canPay"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await linkPlayerAccountToPlayer(ctx, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/players/${playerId}`);
  return { ok: true, error: null };
}

export async function removeGuardianAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  await unlinkPlayerAccountFromPlayer(ctx, str(fd, "linkId"));
  revalidatePath(`/players/${playerId}`);
}

/** Regenerate + return the accept link for a pending player account invite (rotates the token). */
export async function copyPlayerAccountInviteLinkAction(
  invitationId: string,
): Promise<{ ok: boolean; error: string | null; acceptUrl?: string }> {
  const { ctx } = await requireUserAndContext();
  try {
    const res = await resendPlayerAccountInvitation(ctx, invitationId);
    if (!res) return { ok: false, error: "Invitation not found." };
    return { ok: true, error: null, acceptUrl: res.acceptUrl };
  } catch (e) {
    return { ok: false, error: failService(e).error };
  }
}

/** Search club player accounts for the "Link existing player account" picker. Returns [] on denial/empty. */
export async function searchGuardiansAction(
  query: string,
): Promise<{ id: string; name: string; email: string }[]> {
  const { ctx } = await requireUserAndContext();
  if (!ctx.activeClubId) return [];
  try {
    const playerAccounts = await searchClubPlayerAccounts(ctx, ctx.activeClubId, query);
    return playerAccounts.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.email }));
  } catch {
    return [];
  }
}

// --- Player account self-service: edit own child (approved fields only) ----
export async function updateOwnChildAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  // Build only from whitelisted keys; the strict schema rejects anything else.
  const parsed = playerAccountUpdatePlayerSchema.safeParse({
    preferredName: optStr(fd, "preferredName"),
    photoUrl: optStr(fd, "photoUrl"),
    emergencyContactName: optStr(fd, "emergencyContactName"),
    emergencyContactPhone: optStr(fd, "emergencyContactPhone"),
    medicalNotes: optStr(fd, "medicalNotes"),
    allergyNotes: optStr(fd, "allergyNotes"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await updateOwnChild(ctx, playerId, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/my-kids/${playerId}`);
  revalidatePath("/dashboard/player");
  revalidatePath("/squad");
  return { ok: true, error: null };
}
