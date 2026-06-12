import { z } from "zod";

/**
 * Zod schemas for the comms module (announcements + team chat). Shared between
 * client forms and server actions/services; the service layer never trusts
 * client input (BUILD_PLAN §5). Enum-like values mirror the controlled strings
 * in docs/soccer_club_database_schema.md.
 */

// --- Announcements ---------------------------------------------------------
// CUSTOM_SELECTION is deliberately NOT supported in this phase (MVP scope).
export const ANNOUNCEMENT_AUDIENCES = ["CLUB_ALL", "TEAM_ONLY", "COACHES_ONLY", "PLAYERS_ONLY"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const ANNOUNCEMENT_AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  CLUB_ALL: "Everyone in the club",
  TEAM_ONLY: "A specific team",
  COACHES_ONLY: "Coaches only",
  PLAYERS_ONLY: "Players only",
};

export const ANNOUNCEMENT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const baseAnnouncement = z
  .object({
    title: z.string().trim().min(2, "Title is required").max(250),
    body: z.string().trim().min(1, "Message body is required").max(20000),
    audienceType: z.enum(ANNOUNCEMENT_AUDIENCES),
    teamId: z.string().uuid().nullable().optional(),
    /** Keep this announcement at the top of recipients' feeds. */
    pinned: z.boolean().optional(),
    /** Flag as important — shown with an "Important" badge in the feed. */
    important: z.boolean().optional(),
  })
  .refine((d) => d.audienceType !== "TEAM_ONLY" || !!d.teamId, {
    message: "Select a team for a team-only announcement",
    path: ["teamId"],
  });

export const createAnnouncementSchema = baseAnnouncement;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = baseAnnouncement;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

// --- Team chat -------------------------------------------------------------
export const postMessageSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty").max(4000),
  /** Optional already-uploaded chat attachment to link to the message. */
  fileId: z.string().uuid().nullable().optional(),
});
export type PostMessageInput = z.infer<typeof postMessageSchema>;

export const editMessageSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty").max(4000),
});
export type EditMessageInput = z.infer<typeof editMessageSchema>;

/** Window during which a member may edit/delete their own message. */
export const MESSAGE_EDIT_GRACE_MS = 15 * 60 * 1000;
