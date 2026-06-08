"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserAndContext } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import type { FormState } from "@/modules/comms/action-state";
import {
  archiveAnnouncement,
  createAnnouncement,
  markClubAnnouncementRead,
  publishAnnouncement,
  updateAnnouncement,
} from "@/modules/comms/service";
import { createAnnouncementSchema, updateAnnouncementSchema } from "@/modules/comms/schemas";

function failZod(error: z.ZodError): FormState {
  return { ok: false, error: error.issues[0]?.message ?? "Invalid input" };
}
function failService(error: unknown): FormState {
  if (error instanceof ForbiddenError) return { ok: false, error: "You don't have access to do that." };
  throw error;
}
function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
function optStr(fd: FormData, key: string): string | undefined {
  const v = str(fd, key).trim();
  return v.length > 0 ? v : undefined;
}

export async function createAnnouncementAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  if (!ctx.activeClubId) return { ok: false, error: "No active club." };
  const parsed = createAnnouncementSchema.safeParse({
    title: str(fd, "title"),
    body: str(fd, "body"),
    audienceType: str(fd, "audienceType"),
    teamId: optStr(fd, "teamId") ?? null,
    pinned: fd.get("pinned") != null,
    important: fd.get("important") != null,
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await createAnnouncement(ctx, ctx.activeClubId, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/announcements");
  return { ok: true, error: null };
}

export async function updateAnnouncementAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const id = str(fd, "id");
  const parsed = updateAnnouncementSchema.safeParse({
    title: str(fd, "title"),
    body: str(fd, "body"),
    audienceType: str(fd, "audienceType"),
    teamId: optStr(fd, "teamId") ?? null,
    pinned: fd.get("pinned") != null,
    important: fd.get("important") != null,
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await updateAnnouncement(ctx, id, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/announcements");
  revalidatePath(`/announcements/${id}`);
  return { ok: true, error: null };
}

/** Best-effort: mark a club announcement read for the caller (e.g. from a dashboard panel). */
export async function markClubAnnouncementReadAction(id: string): Promise<void> {
  const { ctx } = await requireUserAndContext();
  try {
    await markClubAnnouncementRead(ctx, id);
  } catch {
    // Read-tracking is non-critical; never surface an error to the UI.
  }
}

export async function publishAnnouncementAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  await publishAnnouncement(ctx, str(fd, "id"));
  revalidatePath("/announcements");
}

export async function archiveAnnouncementAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  await archiveAnnouncement(ctx, str(fd, "id"));
  revalidatePath("/announcements");
}
