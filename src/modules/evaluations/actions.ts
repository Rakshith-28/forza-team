"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUserAndContext } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import type { FormState } from "@/modules/evaluations/action-state";
import {
  ConflictError,
  createCriterion,
  createCycle,
  createTemplate,
  savePlayerEvaluation,
  updateCriterion,
  updateCycle,
  updateTemplate,
} from "@/modules/evaluations/service";
import {
  createCriterionSchema,
  createCycleSchema,
  createTemplateSchema,
  savePlayerEvaluationSchema,
  updateCriterionSchema,
  updateCycleSchema,
  updateTemplateSchema,
} from "@/modules/evaluations/schemas";

function failZod(error: z.ZodError): FormState {
  return { ok: false, error: error.issues[0]?.message ?? "Invalid input" };
}
function failService(error: unknown): FormState {
  if (error instanceof ForbiddenError) return { ok: false, error: "You don't have access to do that." };
  if (error instanceof ConflictError) return { ok: false, error: error.message };
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

// --- Templates -------------------------------------------------------------
export async function createTemplateAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  if (!ctx.activeClubId) return { ok: false, error: "No active club." };
  const parsed = createTemplateSchema.safeParse({ name: str(fd, "name"), description: optStr(fd, "description") });
  if (!parsed.success) return failZod(parsed.error);
  let id: string;
  try {
    const t = await createTemplate(ctx, ctx.activeClubId, parsed.data);
    id = t.id;
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/evaluations");
  redirect(`/evaluations/templates/${id}`);
}

export async function updateTemplateAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const id = str(fd, "templateId");
  const parsed = updateTemplateSchema.safeParse({ name: str(fd, "name"), description: optStr(fd, "description") });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await updateTemplate(ctx, id, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/evaluations/templates/${id}`);
  return { ok: true, error: null };
}

export async function createCriterionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const templateId = str(fd, "templateId");
  const parsed = createCriterionSchema.safeParse({
    code: str(fd, "code"),
    label: str(fd, "label"),
    minScore: str(fd, "minScore") || undefined,
    maxScore: str(fd, "maxScore") || undefined,
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await createCriterion(ctx, templateId, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/evaluations/templates/${templateId}`);
  return { ok: true, error: null };
}

export async function updateCriterionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const templateId = str(fd, "templateId");
  const parsed = updateCriterionSchema.safeParse({
    label: str(fd, "label"),
    minScore: str(fd, "minScore"),
    maxScore: str(fd, "maxScore"),
    isActive: fd.get("isActive") != null,
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await updateCriterion(ctx, str(fd, "criterionId"), parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/evaluations/templates/${templateId}`);
  return { ok: true, error: null };
}

// --- Cycles ----------------------------------------------------------------
export async function createCycleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  if (!ctx.activeClubId) return { ok: false, error: "No active club." };
  const parsed = createCycleSchema.safeParse({
    name: str(fd, "name"),
    cycleType: str(fd, "cycleType"),
    teamId: optStr(fd, "teamId") ?? null,
    startsAt: str(fd, "startsAt"),
    endsAt: str(fd, "endsAt"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await createCycle(ctx, ctx.activeClubId, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/evaluations/cycles");
  return { ok: true, error: null };
}

export async function updateCycleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const id = str(fd, "cycleId");
  const parsed = updateCycleSchema.safeParse({
    name: str(fd, "name"),
    cycleType: str(fd, "cycleType"),
    teamId: optStr(fd, "teamId") ?? null,
    startsAt: str(fd, "startsAt"),
    endsAt: str(fd, "endsAt"),
    status: str(fd, "status"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await updateCycle(ctx, id, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/evaluations/cycles");
  return { ok: true, error: null };
}

// --- Player evaluation -----------------------------------------------------
export async function savePlayerEvaluationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const criterionIds = fd.getAll("criterionId").filter((v): v is string => typeof v === "string");
  const scores = criterionIds.map((cid) => ({ criterionId: cid, rawScore: str(fd, `score_${cid}`) || "0" }));
  const parsed = savePlayerEvaluationSchema.safeParse({
    playerId: str(fd, "playerId"),
    teamId: str(fd, "teamId"),
    evaluationCycleId: str(fd, "evaluationCycleId"),
    templateId: str(fd, "templateId"),
    scores,
    summaryComment: optStr(fd, "summaryComment"),
    coachOnlyNotes: optStr(fd, "coachOnlyNotes"),
    parentVisibleNotes: optStr(fd, "parentVisibleNotes"),
  });
  if (!parsed.success) return failZod(parsed.error);
  try {
    await savePlayerEvaluation(ctx, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/players/${parsed.data.playerId}`);
  revalidatePath("/evaluations");
  return { ok: true, error: null };
}
