"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserAndContext } from "@/lib/auth-guards";
import { updateMyAccount } from "@/modules/identity/account";

export interface AccountFormState {
  ok: boolean;
  error: string | null;
}

const schema = z.object({
  phone: z.string().trim().max(30).optional(),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  chatNotificationsEnabled: z.boolean(),
  announcementNotificationsEnabled: z.boolean(),
  billingNotificationsEnabled: z.boolean(),
  scheduleNotificationsEnabled: z.boolean(),
});

export async function updateMyAccountAction(_prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  const { ctx } = await requireUserAndContext();
  const parsed = schema.safeParse({
    phone: typeof fd.get("phone") === "string" ? (fd.get("phone") as string) : "",
    emailEnabled: fd.get("emailEnabled") != null,
    pushEnabled: fd.get("pushEnabled") != null,
    smsEnabled: fd.get("smsEnabled") != null,
    chatNotificationsEnabled: fd.get("chatNotificationsEnabled") != null,
    announcementNotificationsEnabled: fd.get("announcementNotificationsEnabled") != null,
    billingNotificationsEnabled: fd.get("billingNotificationsEnabled") != null,
    scheduleNotificationsEnabled: fd.get("scheduleNotificationsEnabled") != null,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { phone, ...notifications } = parsed.data;
  await updateMyAccount(ctx, { phone: phone?.trim() ? phone.trim() : null, notifications });
  revalidatePath("/account");
  return { ok: true, error: null };
}
