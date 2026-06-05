"use server";

import { revalidatePath } from "next/cache";

import { requireUserAndContext } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import {
  addDevelopmentGoalUpdate,
  createDevelopmentGoal,
} from "@/modules/evaluations/development-service";
import { addGoalUpdateSchema, createGoalSchema } from "@/modules/evaluations/development-schemas";

export interface DevResult {
  ok: boolean;
  error: string | null;
}

function fail(e: unknown): DevResult {
  if (e instanceof ForbiddenError) return { ok: false, error: "You don't have access to do that." };
  throw e;
}

export async function createDevelopmentGoalAction(input: {
  playerId: string;
  title: string;
  category?: string;
  visibility: string;
  targetDate: string | null;
}): Promise<DevResult> {
  const { ctx } = await requireUserAndContext();
  if (!ctx.activeClubId) return { ok: false, error: "No active club." };
  const parsed = createGoalSchema.safeParse({
    playerId: input.playerId,
    title: input.title,
    category: input.category?.trim() || undefined,
    visibility: input.visibility,
    targetDate: input.targetDate ? new Date(input.targetDate) : null,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await createDevelopmentGoal(ctx, ctx.activeClubId, parsed.data);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/development");
  return { ok: true, error: null };
}

export async function addGoalUpdateAction(
  goalId: string,
  input: { progressStatus: string; notes?: string },
): Promise<DevResult> {
  const { ctx } = await requireUserAndContext();
  const parsed = addGoalUpdateSchema.safeParse({ progressStatus: input.progressStatus, notes: input.notes?.trim() || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await addDevelopmentGoalUpdate(ctx, goalId, parsed.data);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/development");
  return { ok: true, error: null };
}
