import { PageHeader } from "@/components/console";
import { RoleSwitcher } from "@/components/app/role-switcher";
import { SignOutButton } from "@/components/app/sign-out-button";
import { requireUserAndContext } from "@/lib/auth-guards";
import { getMyAccount } from "@/modules/identity/account";
import { getUserClubRoles } from "@/modules/identity/context";

import { AccountForm } from "./account-form";

export default async function AccountPage() {
  const { ctx } = await requireUserAndContext();
  const account = await getMyAccount(ctx);
  const clubRoles = ctx.activeClubId ? await getUserClubRoles(ctx.userId, ctx.activeClubId) : [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Account" description="Your profile, notifications, and session." />

      <div className="mt-6">
        <AccountForm account={account} />
      </div>

      {clubRoles.length > 1 ? (
        <div className="mt-6">
          <RoleSwitcher roles={clubRoles} current={ctx.role} />
        </div>
      ) : null}

      <section className="mt-6 flex items-center justify-between rounded-xl border bg-card p-5 shadow-sm">
        <div>
          <h2 className="font-sport text-base font-bold text-foreground">Sign out</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">End your session on this device.</p>
        </div>
        <SignOutButton className="border bg-background" />
      </section>
    </div>
  );
}
