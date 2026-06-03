import { z } from "zod";

/**
 * Zod schemas for the events module (events, RSVP, attendance). Shared between
 * client forms and server actions/services; the service layer never trusts
 * client input (BUILD_PLAN §5). Enum-like values mirror the controlled strings
 * in docs/soccer_club_database_schema.md.
 */

// --- Controlled vocabularies ----------------------------------------------
export const EVENT_TYPES = [
  "PRACTICE",
  "GAME",
  "TEAM_MEETING",
  "CLUB_EVENT",
  "TOURNAMENT",
  "TEAM_EVENT",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  PRACTICE: "Practice",
  GAME: "Game",
  TEAM_MEETING: "Team Meeting",
  CLUB_EVENT: "Club Event",
  TOURNAMENT: "Tournament",
  TEAM_EVENT: "Team Event",
};

export const EVENT_STATUSES = ["SCHEDULED", "CANCELLED", "COMPLETED", "POSTPONED"] as const;

export const RSVP_STATUSES = ["GOING", "NOT_GOING", "MAYBE", "LATE"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export const RSVP_LABELS: Record<RsvpStatus, string> = {
  GOING: "Going",
  NOT_GOING: "Not going",
  MAYBE: "Maybe",
  LATE: "Late",
};

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "EXCUSED_ABSENT",
  "UNEXCUSED_ABSENT",
  "LATE",
  "INJURED",
  "PARTIAL",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  EXCUSED_ABSENT: "Excused",
  UNEXCUSED_ABSENT: "Absent",
  LATE: "Late",
  INJURED: "Injured",
  PARTIAL: "Partial",
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

const HOME_AWAY = ["HOME", "AWAY", "NEUTRAL"] as const;

// --- Events ----------------------------------------------------------------
const baseEvent = z
  .object({
    title: z.string().trim().min(2, "Title is required").max(200),
    eventType: z.enum(EVENT_TYPES),
    // null = club-wide (admin only, enforced in the service).
    teamId: z.string().uuid().nullable().optional(),
    description: optionalText(4000),
    startAt: z.coerce.date({ message: "Valid start date/time required" }),
    endAt: z.coerce.date({ message: "Valid end date/time required" }),
    timezone: optionalText(100),
    locationName: optionalText(200),
    addressLine1: optionalText(200),
    city: optionalText(100),
    state: optionalText(100),
    postalCode: optionalText(20),
    opponentName: optionalText(200),
    homeAway: z.enum(HOME_AWAY).optional().or(z.literal("").transform(() => undefined)),
    arrivalTime: z.coerce.date().optional().nullable().catch(null),
    uniformNotes: optionalText(2000),
  })
  .refine((d) => d.endAt >= d.startAt, {
    message: "End time must be on or after the start time",
    path: ["endAt"],
  });

export const createEventSchema = baseEvent;
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(2, "Title is required").max(200),
    eventType: z.enum(EVENT_TYPES),
    teamId: z.string().uuid().nullable().optional(),
    description: optionalText(4000),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    timezone: optionalText(100),
    locationName: optionalText(200),
    addressLine1: optionalText(200),
    city: optionalText(100),
    state: optionalText(100),
    postalCode: optionalText(20),
    opponentName: optionalText(200),
    homeAway: z.enum(HOME_AWAY).optional().or(z.literal("").transform(() => undefined)),
    arrivalTime: z.coerce.date().optional().nullable().catch(null),
    uniformNotes: optionalText(2000),
    status: z.enum(EVENT_STATUSES),
  })
  .refine((d) => d.endAt >= d.startAt, {
    message: "End time must be on or after the start time",
    path: ["endAt"],
  });
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

// --- RSVP ------------------------------------------------------------------
export const rsvpSchema = z.object({
  playerId: z.string().uuid(),
  responseStatus: z.enum(RSVP_STATUSES),
  comment: optionalText(500),
});
export type RsvpInput = z.infer<typeof rsvpSchema>;

// --- Attendance (single + bulk) --------------------------------------------
export const attendanceEntrySchema = z.object({
  playerId: z.string().uuid(),
  attendanceStatus: z.enum(ATTENDANCE_STATUSES),
  notes: optionalText(500),
});
export type AttendanceEntryInput = z.infer<typeof attendanceEntrySchema>;

export const bulkAttendanceSchema = z.object({
  entries: z.array(attendanceEntrySchema).min(1, "No attendance entries"),
});
export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;
