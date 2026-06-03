import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-guards";

// Root entry: bounce to sign-in when anonymous, otherwise hand off to the
// /dashboard dispatcher which routes to each role's home (ROLE_HOME).
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  redirect("/dashboard");
}
