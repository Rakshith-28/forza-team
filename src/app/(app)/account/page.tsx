import { PageHeader } from "@/components/console";
import { SignOutButton } from "@/components/app/sign-out-button";
import { requireUserAndContext } from "@/lib/auth-guards";
import { getMyAccount } from "@/modules/identity/account";

import { AccountForm } from "./account-form";

export default async function AccountPage() {
  const { ctx } = await requireUserAndContext();
  const account = await getMyAccount(ctx);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Account" description="Your profile, notifications, and session." />

      <div className="mt-6">
        <AccountForm account={account} />
      </div>

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
