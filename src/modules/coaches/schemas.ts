import { z } from "zod";

import { COACH_ROLE_TYPES } from "@/modules/clubs/schemas";

/**
 * Zod schemas for the coaches module (invite + filters). Reuses the coach
 * role-type vocabulary from the clubs module; assign/remove reuse the Phase 2
 * clubs schemas/service. Shared between client forms and server actions.
 */

export const COACH_STATUSES = ["ACTIVE", "PENDING", "INACTIVE"] as const;
export type CoachStatus = (typeof COACH_STATUSES)[number];

export const inviteCoachSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email required").max(255),
  // Optional initial team + role type (applied when the invite is accepted).
  teamId: z.string().uuid().nullable().optional(),
  roleType: z.enum(COACH_ROLE_TYPES).optional(),
});
export type InviteCoachInput = z.infer<typeof inviteCoachSchema>;

export interface CoachFilters {
  team?: string;
  status?: CoachStatus;
  search?: string;
}
