"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUserAndContext } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import type { FormState } from "@/modules/clubs/action-state";
import {
  assignCoach,
  archiveClub,
  archiveSeason,
  archiveTeam,
  ConflictError,
  createClub,
  createSeason,
  createTeam,
  removeCoach,
  updateClub,
  updateSeason,
  updateTeam,
} from "@/modules/clubs/service";
import {
  assignCoachSchema,
  createClubSchema,
  createSeasonSchema,
  createTeamSchema,
  updateClubSchema,
  updateSeasonSchema,
  updateTeamSchema,
} from "@/modules/clubs/schemas";

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

async function activeClub() {
  const { ctx } = await requireUserAndContext();
  return { ctx, clubId: ctx.activeClubId };
}

// --- Clubs (Master) --------------------------------------------------------
export async function createClubAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const parsed = createClubSchema.safeParse({ name: str(fd, "name"), shortCode: str(fd, "shortCode") });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await createClub(ctx, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/clubs");
  return { ok: true, error: null };
}

export async function updateClubAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const parsed = updateClubSchema.safeParse({ name: str(fd, "name") });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await updateClub(ctx, str(fd, "clubId"), parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/clubs");
  revalidatePath("/dashboard/club");
  return { ok: true, error: null };
}

export async function archiveClubAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  await archiveClub(ctx, str(fd, "clubId"));
  revalidatePath("/clubs");
}

// --- Seasons ---------------------------------------------------------------
export async function createSeasonAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx, clubId } = await activeClub();
  if (!clubId) return { ok: false, error: "No active club." };
  const parsed = createSeasonSchema.safeParse({
    name: str(fd, "name"),
    startDate: str(fd, "startDate"),
    endDate: str(fd, "endDate"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await createSeason(ctx, clubId, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/seasons");
  return { ok: true, error: null };
}

export async function updateSeasonAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const parsed = updateSeasonSchema.safeParse({
    name: str(fd, "name"),
    startDate: str(fd, "startDate"),
    endDate: str(fd, "endDate"),
    status: str(fd, "status"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await updateSeason(ctx, str(fd, "seasonId"), parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/seasons");
  return { ok: true, error: null };
}

export async function archiveSeasonAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  await archiveSeason(ctx, str(fd, "seasonId"));
  revalidatePath("/seasons");
}

// --- Teams -----------------------------------------------------------------
export async function createTeamAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx, clubId } = await activeClub();
  if (!clubId) return { ok: false, error: "No active club." };
  const parsed = createTeamSchema.safeParse({
    name: str(fd, "name"),
    teamCode: str(fd, "teamCode"),
    seasonId: optStr(fd, "seasonId") ?? null,
    ageGroup: optStr(fd, "ageGroup"),
    division: optStr(fd, "division"),
    competitiveLevel: optStr(fd, "competitiveLevel"),
  });
  if (!parsed.success) return failZod(parsed.error);
  let teamId: string;
  try {
    const team = await createTeam(ctx, clubId, parsed.data);
    teamId = team.id;
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/teams");
  redirect(`/teams/${teamId}`);
}

export async function updateTeamAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const teamId = str(fd, "teamId");
  const parsed = updateTeamSchema.safeParse({
    name: str(fd, "name"),
    teamCode: str(fd, "teamCode"),
    seasonId: optStr(fd, "seasonId") ?? null,
    ageGroup: optStr(fd, "ageGroup"),
    division: optStr(fd, "division"),
    competitiveLevel: optStr(fd, "competitiveLevel"),
    status: str(fd, "status"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await updateTeam(ctx, teamId, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/teams");
  revalidatePath(`/teams/${teamId}`);
  return { ok: true, error: null };
}

export async function archiveTeamAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  await archiveTeam(ctx, str(fd, "teamId"));
  revalidatePath("/teams");
  redirect("/teams");
}

// --- Coach assignment ------------------------------------------------------
export async function assignCoachAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const teamId = str(fd, "teamId");
  const parsed = assignCoachSchema.safeParse({
    teamId,
    userId: str(fd, "userId"),
    roleType: str(fd, "roleType"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await assignCoach(ctx, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/teams/${teamId}`);
  return { ok: true, error: null };
}

export async function removeCoachAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  const teamId = str(fd, "teamId");
  await removeCoach(ctx, teamId, str(fd, "userId"));
  revalidatePath(`/teams/${teamId}`);
}
