import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth-guards";
import { ROLE_HOME } from "@/lib/rbac";

// Post-sign-in dispatcher: send each user to their role's home dashboard.
export default async function DashboardPage() {
  const ctx = await requireAuthContext();
  redirect(ROLE_HOME[ctx.role]);
}
