import { redirect } from "next/navigation";

import { readActiveIdentityKey } from "@/lib/active-identity";
import { requireUser } from "@/lib/auth-guards";
import { ROLE_HOME } from "@/lib/rbac";
import { listUserIdentities } from "@/modules/identity/identities";

/**
 * Post-sign-in dispatcher. Routes each user based on the identities they hold:
 * - none → /no-access
 * - already acting as a chosen identity (cookie) → that role's home
 * - exactly one identity → straight to its home (nothing to choose)
 * - multiple, none chosen yet → the "Select Role" popup
 *
 * The identity cookie is cleared on sign-out, so a multi-identity user gets the
 * picker on every login.
 */
export default async function DashboardPage() {
  const session = await requireUser();
  const identities = await listUserIdentities(session.user.id);
  if (identities.length === 0) redirect("/no-access");

  const key = await readActiveIdentityKey();
  const chosen = key ? identities.find((i) => i.key === key) : null;
  if (chosen) redirect(ROLE_HOME[chosen.role]);
  if (identities.length === 1) redirect(ROLE_HOME[identities[0].role]);

  redirect("/select-role");
}
