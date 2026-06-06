import { PageHeader } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { getSystemSettings } from "@/modules/master/service";

import { SystemSettingsForm } from "./settings-form";

export default async function SystemSettingsPage() {
  const ctx = await requireRole("MASTER_ADMIN");
  const settings = await getSystemSettings(ctx);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="System Settings" description="Global, platform-wide configuration and new-club defaults." />
      <div className="mt-6">
        <SystemSettingsForm settings={settings} />
      </div>
    </div>
  );
}
