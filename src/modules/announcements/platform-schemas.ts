import { z } from "zod";

/**
 * Vocab + Zod for platform announcements (Master Admin broadcasts). Plain module
 * (no "use server") so client composer UI can import the constants/types.
 */

export const SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABELS: Record<Severity, string> = {
  INFO: "Info",
  WARNING: "Warning",
  CRITICAL: "Critical",
};

export const AUDIENCE_SCOPES = ["ALL_CLUBS", "SPECIFIC_CLUBS"] as const;
export type AudienceScope = (typeof AUDIENCE_SCOPES)[number];

export const ANNOUNCEMENT_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

// Roles that can be targeted (Master Admin is the publisher, never a recipient).
export const AUDIENCE_ROLE_CODES = ["CLUB_ADMIN", "COACH", "PARENT"] as const;
export type AudienceRoleCode = (typeof AUDIENCE_ROLE_CODES)[number];

const announcementShape = {
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().min(1, "Body is required"),
  severity: z.enum(SEVERITIES),
  audienceScope: z.enum(AUDIENCE_SCOPES),
  audienceRoles: z.array(z.enum(AUDIENCE_ROLE_CODES)).min(1, "Pick at least one role"),
  clubIds: z.array(z.string().uuid()).default([]),
  scheduledAt: z.date().nullable().default(null),
  expiresAt: z.date().nullable().default(null),
  pinned: z.boolean().default(false),
  publishNow: z.boolean().default(false),
};

export const platformAnnouncementInputSchema = z
  .object(announcementShape)
  .refine((d) => d.audienceScope !== "SPECIFIC_CLUBS" || d.clubIds.length > 0, {
    message: "Select at least one club",
    path: ["clubIds"],
  })
  .refine((d) => !(d.scheduledAt && d.expiresAt) || d.expiresAt.getTime() > d.scheduledAt.getTime(), {
    message: "Expiry must be after the scheduled time",
    path: ["expiresAt"],
  })
  .refine((d) => d.expiresAt == null || d.expiresAt.getTime() > Date.now(), {
    message: "Expiry must be in the future",
    path: ["expiresAt"],
  });
export type PlatformAnnouncementInput = z.infer<typeof platformAnnouncementInputSchema>;

export const platformTemplateInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().min(1, "Body is required"),
  severity: z.enum(SEVERITIES),
  defaultAudienceScope: z.enum(AUDIENCE_SCOPES),
  defaultAudienceRoles: z.array(z.enum(AUDIENCE_ROLE_CODES)).min(1, "Pick at least one role"),
});
export type PlatformTemplateInput = z.infer<typeof platformTemplateInputSchema>;
