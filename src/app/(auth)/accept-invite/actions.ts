"use server";

import { redirect } from "next/navigation";

import { acceptInvitation } from "@/modules/identity/invitations";

export interface AcceptInviteState {
  error: string | null;
}

const MESSAGES: Record<string, string> = {
  invalid: "This invitation link is invalid.",
  expired: "This invitation has expired. Ask an admin to resend it.",
  already_used: "This invitation has already been used.",
  signup_failed: "Could not create your account. The email may already be registered.",
  validation: "Please fill in all fields; password must be at least 8 characters.",
};

export async function acceptInviteAction(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const id = String(formData.get("id") ?? "");
  const token = String(formData.get("token") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();

  if (!id || !token || !firstName || !lastName || password.length < 8) {
    return { error: MESSAGES.validation };
  }

  const result = await acceptInvitation({
    invitationId: id,
    token,
    firstName,
    lastName,
    password,
    phone: phone || undefined,
  });

  if (!result.ok) {
    return { error: MESSAGES[result.error] ?? "Something went wrong." };
  }

  // Account created and signed in (nextCookies plugin set the session cookie).
  redirect("/dashboard");
}
