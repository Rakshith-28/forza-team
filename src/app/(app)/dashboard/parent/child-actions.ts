"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { ACTIVE_CHILD_COOKIE } from "@/lib/active-child";
import { requireUserAndContext } from "@/lib/auth-guards";
import { env } from "@/lib/env";

/**
 * Focus the parent portal on one of the caller's linked children. Guard: the
 * child must be in the parent's own `linkedPlayerIds` (no access to other
 * families). Purely changes which child the UI highlights — not scope.
 */
export async function setActiveChildAction(formData: FormData): Promise<void> {
  const childId = String(formData.get("childId") ?? "");
  const { ctx } = await requireUserAndContext();
  if (ctx.role !== "PARENT" || !ctx.linkedPlayerIds.includes(childId)) return;

  (await cookies()).set(ACTIVE_CHILD_COOKIE, childId, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/dashboard/parent");
  revalidatePath("/squad");
}
