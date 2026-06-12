import { z } from "zod";

/**
 * Zod schemas for the evaluations module (templates, criteria, cycles, player
 * evaluations). MVP scope: UNWEIGHTED scoring — no position weighting, ranking,
 * or buckets. Shared between client forms and server actions/services.
 */

// Default criteria seeded onto a new template (Phase 6 MVP set).
export const DEFAULT_CRITERIA: { code: string; label: string }[] = [
  { code: "WORK_RATE", label: "Work Rate" },
  { code: "PASSING", label: "Passing" },
  { code: "DRIBBLING", label: "Dribbling" },
  { code: "PHYSICALITY", label: "Physicality" },
  { code: "AGGRESSION", label: "Aggression" },
  { code: "PACE", label: "Pace" },
  { code: "TACTICAL_AWARENESS", label: "Tactical Awareness" },
];

export const DEFAULT_MIN_SCORE = 0;
export const DEFAULT_MAX_SCORE = 10;

export const CYCLE_TYPES = ["PRESEASON", "MIDSEASON", "POSTSEASON", "CUSTOM"] as const;
export const CYCLE_TYPE_LABELS: Record<(typeof CYCLE_TYPES)[number], string> = {
  PRESEASON: "Pre-season",
  MIDSEASON: "Mid-season",
  POSTSEASON: "Post-season",
  CUSTOM: "Custom",
};

export const CYCLE_STATUSES = ["ACTIVE", "CLOSED", "ARCHIVED"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

// --- Templates + criteria --------------------------------------------------
export const createTemplateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  description: optionalText(2000),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  description: optionalText(2000),
});
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

const codeField = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Uppercase letters, numbers, underscores")
  ;

export const createCriterionSchema = z
  .object({
    code: codeField,
    label: z.string().trim().min(1, "Label is required").max(150),
    minScore: z.coerce.number().min(0).max(100).default(DEFAULT_MIN_SCORE),
    maxScore: z.coerce.number().min(1).max(100).default(DEFAULT_MAX_SCORE),
  })
  .refine((d) => d.maxScore > d.minScore, { message: "Max must exceed min", path: ["maxScore"] });
export type CreateCriterionInput = z.infer<typeof createCriterionSchema>;

export const updateCriterionSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(150),
    minScore: z.coerce.number().min(0).max(100),
    maxScore: z.coerce.number().min(1).max(100),
    isActive: z.coerce.boolean(),
  })
  .refine((d) => d.maxScore > d.minScore, { message: "Max must exceed min", path: ["maxScore"] });
export type UpdateCriterionInput = z.infer<typeof updateCriterionSchema>;

// --- Cycles ----------------------------------------------------------------
export const createCycleSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(150),
    cycleType: z.enum(CYCLE_TYPES),
    teamId: z.string().uuid().nullable().optional(),
    seasonId: z.string().uuid().nullable().optional(),
    startsAt: z.coerce.date({ message: "Valid start date required" }),
    endsAt: z.coerce.date({ message: "Valid end date required" }),
  })
  .refine((d) => d.endsAt >= d.startsAt, { message: "End must be on/after start", path: ["endsAt"] });
export type CreateCycleInput = z.infer<typeof createCycleSchema>;

export const updateCycleSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(150),
    cycleType: z.enum(CYCLE_TYPES),
    teamId: z.string().uuid().nullable().optional(),
    seasonId: z.string().uuid().nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    status: z.enum(CYCLE_STATUSES),
  })
  .refine((d) => d.endsAt >= d.startsAt, { message: "End must be on/after start", path: ["endsAt"] });
export type UpdateCycleInput = z.infer<typeof updateCycleSchema>;

// --- Player evaluation -----------------------------------------------------
export const scoreEntrySchema = z.object({
  criterionId: z.string().uuid(),
  rawScore: z.coerce.number().min(0).max(100),
});

/**
 * MVP overall score = simple UNWEIGHTED mean of the criterion raw scores.
 * No position weighting is applied (pure + unit-testable).
 */
export function unweightedOverall(rawScores: number[]): number {
  if (rawScores.length === 0) return 0;
  return rawScores.reduce((sum, s) => sum + s, 0) / rawScores.length;
}

export const savePlayerEvaluationSchema = z.object({
  playerId: z.string().uuid(),
  teamId: z.string().uuid(),
  evaluationCycleId: z.string().uuid(),
  templateId: z.string().uuid(),
  scores: z.array(scoreEntrySchema).min(1, "At least one criterion score is required"),
  summaryComment: optionalText(4000),
  coachOnlyNotes: optionalText(4000),
  playerVisibleNotes: optionalText(4000),
});
export type SavePlayerEvaluationInput = z.infer<typeof savePlayerEvaluationSchema>;
