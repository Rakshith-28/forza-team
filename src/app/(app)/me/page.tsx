import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/app/sign-out-button";
import { RoleSwitcher } from "@/components/app/role-switcher";
import { AppearanceSwitcher } from "@/components/app/parent/appearance-switcher";
import { requireUserAndContext } from "@/lib/auth-guards";
import { ROLE_HOME } from "@/lib/rbac";
import { getUserClubRoles } from "@/modules/identity/context";
import { listLinkedChildren } from "@/modules/roster/service";

/**
 * Me tab — profile + the Appearance switcher (Vibrant / Classic) + quick links.
 * PARENT-only: the Appearance switcher needs the parent shell's theme provider,
 * so non-parents are redirected to their own home (Console).
 */
export default async function MePage() {
  const { session, ctx } = await requireUserAndContext();
  if (ctx.role !== "PARENT") redirect(ROLE_HOME[ctx.role]);
  const children = await listLinkedChildren(ctx);
  const clubRoles = ctx.activeClubId ? await getUserClubRoles(ctx.userId, ctx.activeClubId) : [];
  const displayName = session.user.name || session.user.email;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="font-display text-2xl uppercase text-foreground">Me</h1>
        <p className="text-sm text-muted-foreground">{displayName}</p>
      </div>

      <section className="app-card p-4">
        <h2 className="font-sport text-base font-bold uppercase text-foreground">Appearance</h2>
        <p className="mb-3 text-xs text-muted-foreground">Choose how your app looks. Saved automatically.</p>
        <AppearanceSwitcher />
      </section>

      {children.length > 0 ? (
        <section className="app-card p-4">
          <h2 className="font-sport text-base font-bold uppercase text-foreground">My kids</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {children.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/my-kids/${c.id}`}
                  className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm"
                >
                  <span className="font-medium text-foreground">{c.displayName}</span>
                  <span className="text-muted-foreground">{c.teams[0]?.name ?? "No team"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {clubRoles.length > 1 ? <RoleSwitcher roles={clubRoles} current={ctx.role} /> : null}

      <div className="flex justify-center pt-2">
        <SignOutButton />
      </div>
    </div>
  );
}
