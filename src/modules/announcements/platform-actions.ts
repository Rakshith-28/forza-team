"use server";

import { revalidatePath } from "next/cache";

import { requireAuthContext, requireRoleOrThrow } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import {
  ConflictError,
  archivePlatformAnnouncement,
  createPlatformAnnouncement,
  createPlatformTemplate,
  deletePlatformAnnouncement,
  deletePlatformTemplate,
  dismissPlatformAnnouncement,
  duplicatePlatformAnnouncement,
  getPlatformAnnouncementDetail,
  markPlatformAnnouncementRead,
  publishPlatformAnnouncement,
  updatePlatformAnnouncement,
  updatePlatformTemplate,
  type PlatformAnnouncementDetail,
} from "@/modules/announcements/platform-service";
import {
  platformAnnouncementInputSchema,
  platformTemplateInputSchema,
} from "@/modules/announcements/platform-schemas";

export interface ActionResult {
  ok: boolean;
  error: string | null;
  id?: string;
}

/** Raw composer payload from the client (dates as ISO strings or null). */
export interface RawAnnouncementInput {
  title: string;
  body: string;
  severity: string;
  audienceScope: string;
  audienceRoles: string[];
  clubIds: string[];
  scheduledAt: string | null;
  expiresAt: string | null;
  pinned: boolean;
  publishNow: boolean;
}

function toDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function friendly(e: unknown): string {
  if (e instanceof ConflictError) return e.message;
  if (e instanceof ForbiddenError) return "You don't have access to do that.";
  throw e;
}

const ANN_PATHS = ["/platform-announcements", "/dashboard/admin"];
function revalidateAnnouncements() {
  for (const p of ANN_PATHS) revalidatePath(p);
}

function parseAnnouncement(input: RawAnnouncementInput) {
  return platformAnnouncementInputSchema.safeParse({
    title: input.title,
    body: input.body,
    severity: input.severity,
    audienceScope: input.audienceScope,
    audienceRoles: input.audienceRoles,
    clubIds: input.clubIds ?? [],
    scheduledAt: toDate(input.scheduledAt),
    expiresAt: toDate(input.expiresAt),
    pinned: !!input.pinned,
    publishNow: !!input.publishNow,
  });
}

export async function createPlatformAnnouncementAction(input: RawAnnouncementInput): Promise<ActionResult> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  const parsed = parseAnnouncement(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    const id = await createPlatformAnnouncement(ctx, parsed.data);
    revalidateAnnouncements();
    return { ok: true, error: null, id };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function updatePlatformAnnouncementAction(id: string, input: RawAnnouncementInput): Promise<ActionResult> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  const parsed = parseAnnouncement(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await updatePlatformAnnouncement(ctx, id, parsed.data);
    revalidateAnnouncements();
    return { ok: true, error: null, id };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function publishPlatformAnnouncementAction(id: string): Promise<ActionResult> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  try {
    await publishPlatformAnnouncement(ctx, id);
    revalidateAnnouncements();
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function archivePlatformAnnouncementAction(id: string): Promise<ActionResult> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  try {
    await archivePlatformAnnouncement(ctx, id);
    revalidateAnnouncements();
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function deletePlatformAnnouncementAction(id: string): Promise<ActionResult> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  try {
    await deletePlatformAnnouncement(ctx, id);
    revalidateAnnouncements();
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function duplicatePlatformAnnouncementAction(id: string): Promise<ActionResult> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  try {
    const newId = await duplicatePlatformAnnouncement(ctx, id);
    revalidateAnnouncements();
    return { ok: true, error: null, id: newId };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function loadPlatformAnnouncementDetailAction(id: string): Promise<PlatformAnnouncementDetail | null> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  return getPlatformAnnouncementDetail(ctx, id);
}

// --- Templates -------------------------------------------------------------

export async function createPlatformTemplateAction(input: unknown): Promise<ActionResult> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  const parsed = platformTemplateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const id = await createPlatformTemplate(ctx, parsed.data);
  revalidatePath("/platform-announcements");
  return { ok: true, error: null, id };
}

export async function updatePlatformTemplateAction(id: string, input: unknown): Promise<ActionResult> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  const parsed = platformTemplateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await updatePlatformTemplate(ctx, id, parsed.data);
  revalidatePath("/platform-announcements");
  return { ok: true, error: null, id };
}

export async function deletePlatformTemplateAction(id: string): Promise<ActionResult> {
  const ctx = await requireRoleOrThrow("MASTER_ADMIN");
  await deletePlatformTemplate(ctx, id);
  revalidatePath("/platform-announcements");
  return { ok: true, error: null };
}

// --- Recipient -------------------------------------------------------------

export async function markPlatformAnnouncementReadAction(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  try {
    await markPlatformAnnouncementRead(ctx, id);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function dismissPlatformAnnouncementAction(id: string): Promise<ActionResult> {
  const ctx = await requireAuthContext();
  try {
    await dismissPlatformAnnouncement(ctx, id);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
