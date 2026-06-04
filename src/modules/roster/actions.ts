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
  archivePlayer,
  createPlayer,
  inviteParent,
  inviteParentForPlayer,
  linkParentToPlayer,
  removePlayerFromTeam,
  searchClubParents,
  unlinkParentFromPlayer,
  updateOwnChild,
  updateParent,
  updatePlayer,
} from "@/modules/roster/service";
import {
  addMembershipSchema,
  createPlayerSchema,
  inviteParentForPlayerSchema,
  inviteParentSchema,
  linkParentSchema,
  parentUpdatePlayerSchema,
  updateParentSchema,
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

export async function archivePlayerAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  await archivePlayer(ctx, str(fd, "playerId"));
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

// --- Parents ---------------------------------------------------------------
export async function inviteParentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx, clubId } = await activeClub();
  if (!clubId) return { ok: false, error: "No active club." };
  const parsed = inviteParentSchema.safeParse({ email: str(fd, "email") });
  if (!parsed.success) return failZod(parsed.error);
  let emailDelivered = true;
  try {
    const result = await inviteParent(ctx, clubId, parsed.data);
    emailDelivered = result.emailDelivered;
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/parents");
  return {
    ok: true,
    error: null,
    notice: emailDelivered
      ? null
      : "Invitation created, but the email couldn't be sent. Check the server logs for the invite link.",
  };
}

export async function updateParentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const parentId = str(fd, "parentId");
  const parsed = updateParentSchema.safeParse({
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
    await updateParent(ctx, parentId, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/parents");
  revalidatePath(`/parents/${parentId}`);
  revalidatePath("/profile");
  return { ok: true, error: null };
}

// --- Parent ↔ player links -------------------------------------------------
export async function linkParentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const parentId = str(fd, "parentId");
  const parsed = linkParentSchema.safeParse({
    playerId: str(fd, "playerId"),
    parentId,
    relationshipType: str(fd, "relationshipType"),
    isPrimaryGuardian: bool(fd, "isPrimaryGuardian"),
    canPickup: bool(fd, "canPickup"),
    canPay: bool(fd, "canPay"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await linkParentToPlayer(ctx, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/parents/${parentId}`);
  revalidatePath(`/players/${parsed.data.playerId}`);
  return { ok: true, error: null };
}

export async function unlinkParentAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  const parentId = str(fd, "parentId");
  await unlinkParentFromPlayer(ctx, str(fd, "linkId"));
  revalidatePath(`/parents/${parentId}`);
}

// --- Player guardians (coach/admin, from the player detail page) -----------
export async function inviteGuardianAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  const parsed = inviteParentForPlayerSchema.safeParse({
    email: str(fd, "email"),
    playerId,
    relationshipType: str(fd, "relationshipType"),
    isPrimaryGuardian: bool(fd, "isPrimaryGuardian"),
    canPickup: bool(fd, "canPickup"),
    canPay: bool(fd, "canPay"),
  });
  if (!parsed.success) return failZod(parsed.error);
  let emailDelivered = true;
  try {
    const result = await inviteParentForPlayer(ctx, parsed.data);
    emailDelivered = result.emailDelivered;
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/players/${playerId}`);
  return {
    ok: true,
    error: null,
    notice: emailDelivered
      ? null
      : "Invitation created, but the email couldn't be sent. Check the server logs for the invite link.",
  };
}

export async function linkGuardianAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  const parsed = linkParentSchema.safeParse({
    playerId,
    parentId: str(fd, "parentId"),
    relationshipType: str(fd, "relationshipType"),
    isPrimaryGuardian: bool(fd, "isPrimaryGuardian"),
    canPickup: bool(fd, "canPickup"),
    canPay: bool(fd, "canPay"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await linkParentToPlayer(ctx, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/players/${playerId}`);
  return { ok: true, error: null };
}

export async function removeGuardianAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  await unlinkParentFromPlayer(ctx, str(fd, "linkId"));
  revalidatePath(`/players/${playerId}`);
}

/** Search club parents for the "Link existing parent" picker. Returns [] on denial/empty. */
export async function searchGuardiansAction(
  query: string,
): Promise<{ id: string; name: string; email: string }[]> {
  const { ctx } = await requireUserAndContext();
  if (!ctx.activeClubId) return [];
  try {
    const parents = await searchClubParents(ctx, ctx.activeClubId, query);
    return parents.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.email }));
  } catch {
    return [];
  }
}

// --- Parent self-service: edit own child (approved fields only) ------------
export async function updateOwnChildAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  // Build only from whitelisted keys; the strict schema rejects anything else.
  const parsed = parentUpdatePlayerSchema.safeParse({
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
  revalidatePath("/dashboard/parent");
  return { ok: true, error: null };
}
