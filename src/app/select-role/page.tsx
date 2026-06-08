import { redirect } from "next/navigation";

import { setActiveIdentityAction } from "@/app/(app)/identity-actions";
import { requireUser } from "@/lib/auth-guards";
import { ROLE_HOME } from "@/lib/rbac/roles";
import { listUserIdentities } from "@/modules/identity/identities";

/**
 * Post-login "Select Role" popup (TeamSnap-style): a multi-identity user picks
 * which identity to act as — "Coach · <team>", "Parent · <child>", etc. Reached
 * from the /dashboard dispatcher only when the user holds 2+ identities and
 * hasn't chosen one this session. Single-identity users are bounced straight to
 * their home. Each row submits the re-validated `setActiveIdentityAction`.
 *
 * Top-level route (outside the (app) shell) so it renders as a focused chooser,
 * not inside the role-aware app chrome.
 */
export default async function SelectRolePage() {
  const session = await requireUser();
  const identities = await listUserIdentities(session.user.id);
  if (identities.length === 0) redirect("/no-access");
  if (identities.length === 1) redirect(ROLE_HOME[identities[0].role]);

  return (
    <main className="flex min-h-svh flex-1 items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-xl">
        <div className="h-1.5 w-full bg-linear-to-r from-primary via-primary/70 to-primary/40" />
        <div className="p-6">
          <h1 className="font-sport text-2xl font-bold tracking-tight text-foreground">Select role</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You hold more than one role. Choose who you&apos;d like to continue as — you can switch
            anytime from the top bar.
          </p>

          <ul className="mt-5 flex flex-col gap-2">
            {identities.map((i) => {
              const sub = [i.roleLabel, i.clubName].filter(Boolean).join(" · ");
              return (
                <li key={i.key}>
                  <form action={setActiveIdentityAction}>
                    <input type="hidden" name="identity" value={i.key} />
                    <button
                      type="submit"
                      className="flex w-full items-center gap-3 rounded-xl border bg-background px-4 py-3 text-left transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                        {i.contextLabel.trim().slice(0, 1).toUpperCase() || "•"}
                      </span>
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-base font-semibold text-foreground">
                          {i.contextLabel}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">{sub}</span>
                      </span>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </main>
  );
}
