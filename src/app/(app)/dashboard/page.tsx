import { redirect } from "next/navigation";

import { readActiveIdentityKey } from "@/lib/active-identity";
import { requireUser } from "@/lib/auth-guards";
import { ROLE_HOME } from "@/lib/rbac";
import { listUserIdentities } from "@/modules/identity/identities";

/**
 * Post-sign-in dispatcher. Sends the user to a role home:
 * - none → /no-access
 * - a chosen identity (cookie) → that role's home
 * - otherwise → the default (highest-privilege) identity's home
 *
 * When the user holds multiple identities but hasn't chosen one yet, the app
 * shell renders the "Select role" gate as a blurred overlay on top of this
 * default dashboard (see (app)/layout.tsx) — so the picker's background is a
 * live, blurred view of the role they'd land on.
 */
export default async function DashboardPage() {
  const session = await requireUser();
  const identities = await listUserIdentities(session.user.id);
  if (identities.length === 0) redirect("/no-access");

  const key = await readActiveIdentityKey();
  const chosen = key ? identities.find((i) => i.key === key) : null;
  redirect(ROLE_HOME[(chosen ?? identities[0]).role]);
}
