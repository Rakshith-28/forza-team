"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUserAndContext } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import type { FormState } from "@/modules/events/action-state";
import {
  cancelEvent,
  createEvent,
  recordAttendance,
  submitRsvp,
  updateEvent,
} from "@/modules/events/service";
import {
  ATTENDANCE_STATUSES,
  bulkAttendanceSchema,
  createEventSchema,
  rsvpSchema,
  updateEventSchema,
  type AttendanceEntryInput,
} from "@/modules/events/schemas";

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

function readEventForm(fd: FormData) {
  return {
    title: str(fd, "title"),
    eventType: str(fd, "eventType"),
    // Canonical audience (the service validates RBAC + normalizes these).
    audienceScope: optStr(fd, "audienceScope"),
    teamIds: fd.getAll("teamIds").filter((v): v is string => typeof v === "string"),
    description: optStr(fd, "description"),
    startAt: str(fd, "startAt"),
    endAt: str(fd, "endAt"),
    timezone: optStr(fd, "timezone"),
    locationName: optStr(fd, "locationName"),
    addressLine1: optStr(fd, "addressLine1"),
    city: optStr(fd, "city"),
    state: optStr(fd, "state"),
    postalCode: optStr(fd, "postalCode"),
    opponentName: optStr(fd, "opponentName"),
    homeAway: str(fd, "homeAway"),
    uniformNotes: optStr(fd, "uniformNotes"),
  };
}

// --- Events ----------------------------------------------------------------
export async function createEventAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  if (!ctx.activeClubId) return { ok: false, error: "No active club." };
  const parsed = createEventSchema.safeParse(readEventForm(fd));
  if (!parsed.success) return failZod(parsed.error);
  let eventId: string;
  try {
    const event = await createEvent(ctx, ctx.activeClubId, parsed.data);
    eventId = event.id;
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/schedule");
  redirect(`/schedule/${eventId}`);
}

export async function updateEventAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const eventId = str(fd, "eventId");
  const parsed = updateEventSchema.safeParse({ ...readEventForm(fd), status: str(fd, "status") });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await updateEvent(ctx, eventId, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/schedule");
  revalidatePath(`/schedule/${eventId}`);
  return { ok: true, error: null };
}

export async function cancelEventAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  const eventId = str(fd, "eventId");
  await cancelEvent(ctx, eventId);
  revalidatePath("/schedule");
  revalidatePath(`/schedule/${eventId}`);
}

// --- RSVP ------------------------------------------------------------------
export async function submitRsvpAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const eventId = str(fd, "eventId");
  const parsed = rsvpSchema.safeParse({
    playerId: str(fd, "playerId"),
    responseStatus: str(fd, "responseStatus"),
    comment: optStr(fd, "comment"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await submitRsvp(ctx, eventId, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/schedule");
  revalidatePath(`/schedule/${eventId}`);
  revalidatePath("/dashboard/parent");
  return { ok: true, error: null };
}

// --- Attendance (bulk quick-entry) -----------------------------------------
export async function recordAttendanceAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const eventId = str(fd, "eventId");
  // Player ids come as repeated hidden inputs; each has a status_<id> select.
  const playerIds = fd.getAll("playerId").filter((v): v is string => typeof v === "string");
  const statuses = new Set<string>(ATTENDANCE_STATUSES);
  const entries: AttendanceEntryInput[] = [];
  for (const pid of playerIds) {
    const status = str(fd, `status_${pid}`);
    if (!statuses.has(status)) continue; // "unset" rows are skipped
    entries.push({
      playerId: pid,
      attendanceStatus: status as AttendanceEntryInput["attendanceStatus"],
      notes: optStr(fd, `notes_${pid}`),
    });
  }
  const parsed = bulkAttendanceSchema.safeParse({ entries });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await recordAttendance(ctx, eventId, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/schedule/${eventId}`);
  return { ok: true, error: null };
}
