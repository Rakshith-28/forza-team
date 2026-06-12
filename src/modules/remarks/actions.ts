"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserAndContext } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import type { FormState } from "@/modules/remarks/action-state";
import { addRemarkSchema } from "@/modules/remarks/schemas";
import { addPlayerRemark, setRemarkVisibility } from "@/modules/remarks/service";

function failZod(error: z.ZodError): FormState {
  return { ok: false, error: error.issues[0]?.message ?? "Invalid input" };
}

function failService(error: unknown): FormState {
  if (error instanceof ForbiddenError) return { ok: false, error: "You don't have access to do that." };
  throw error; // unexpected — let the error boundary handle it
}

/** Coach adds a remark (private unless the "visible to players" toggle is on). */
export async function addPlayerRemarkAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const parsed = addRemarkSchema.safeParse({
    playerId: fd.get("playerId"),
    body: fd.get("body"),
    playerVisible: fd.get("playerVisible") != null,
  });
  if (!parsed.success) return failZod(parsed.error);

  try {
    await addPlayerRemark(ctx, parsed.data);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/attendance");
  return { ok: true, error: null };
}

/** Coach toggles an existing remark's player visibility (shares / hides it). */
export async function setRemarkVisibilityAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const remarkId = typeof fd.get("remarkId") === "string" ? (fd.get("remarkId") as string) : "";
  const playerVisible = fd.get("playerVisible") != null;

  try {
    await setRemarkVisibility(ctx, remarkId, playerVisible);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/attendance");
  return { ok: true, error: null };
}
