import { z } from "zod";

/** Development-goal vocab + Zod, shared by client forms and server actions. */

export const GOAL_STATUSES = ["OPEN", "IN_PROGRESS", "ACHIEVED", "ON_HOLD"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  ACHIEVED: "Achieved",
  ON_HOLD: "On hold",
};

export const GOAL_VISIBILITIES = ["COACH_ONLY", "PLAYER_VISIBLE"] as const;
export type GoalVisibility = (typeof GOAL_VISIBILITIES)[number];

export const createGoalSchema = z.object({
  playerId: z.string().uuid("Pick a player"),
  title: z.string().trim().min(1, "Title is required").max(200),
  category: z.string().trim().max(100).optional(),
  visibility: z.enum(GOAL_VISIBILITIES).default("COACH_ONLY"),
  targetDate: z.date().nullable().default(null),
});
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const addGoalUpdateSchema = z.object({
  progressStatus: z.enum(GOAL_STATUSES),
  notes: z.string().trim().max(2000).optional(),
});
export type AddGoalUpdateInput = z.infer<typeof addGoalUpdateSchema>;
