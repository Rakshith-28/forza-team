import { z } from "zod";

/**
 * Zod schemas for the clubs module (clubs, seasons, teams, coach assignment).
 * Shared by client forms and server actions/services — never trust client input
 * at the service layer (BUILD_PLAN §5). Enum-like values mirror the controlled
 * strings in docs/soccer_club_database_schema.md §5.
 */

export const CLUB_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const SEASON_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const TEAM_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const COACH_ROLE_TYPES = ["HEAD_COACH", "ASSISTANT_COACH", "TEAM_MANAGER"] as const;

export const COACH_ROLE_LABELS: Record<(typeof COACH_ROLE_TYPES)[number], string> = {
  HEAD_COACH: "Head Coach",
  ASSISTANT_COACH: "Assistant Coach",
  TEAM_MANAGER: "Team Manager",
};

const slug = z
  .string()
  .trim()
  .min(2, "At least 2 characters")
  .max(50)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/, "Letters, numbers, spaces, hyphens only");

// --- Clubs -----------------------------------------------------------------
export const createClubSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(200),
  shortCode: slug.transform((s) => s.toUpperCase()),
  timezone: z.string().trim().max(100).optional(),
});
export type CreateClubInput = z.infer<typeof createClubSchema>;

export const updateClubSchema = z.object({
  name: z.string().trim().min(2).max(200),
  timezone: z.string().trim().max(100).optional(),
});
export type UpdateClubInput = z.infer<typeof updateClubSchema>;

// --- Seasons ---------------------------------------------------------------
export const createSeasonSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(150),
    startDate: z.coerce.date({ message: "Valid start date required" }),
    endDate: z.coerce.date({ message: "Valid end date required" }),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });
export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;

export const updateSeasonSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    status: z.enum(SEASON_STATUSES),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });
export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;

// --- Teams -----------------------------------------------------------------
const teamCode = z
  .string()
  .trim()
  .min(1, "Team code is required")
  .max(50)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Letters, numbers, hyphens only")
  .transform((s) => s.toUpperCase());

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  teamCode,
  seasonId: z.string().uuid().nullable().optional(),
  ageGroup: z.string().trim().max(50).optional(),
  division: z.string().trim().max(100).optional(),
  competitiveLevel: z.string().trim().max(100).optional(),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = createTeamSchema.extend({
  status: z.enum(TEAM_STATUSES),
});
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

// --- Coach assignment ------------------------------------------------------
export const assignCoachSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  roleType: z.enum(COACH_ROLE_TYPES),
});
export type AssignCoachInput = z.infer<typeof assignCoachSchema>;
