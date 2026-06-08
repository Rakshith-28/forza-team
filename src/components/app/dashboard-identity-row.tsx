"use client";

import { usePathname } from "next/navigation";

import { IdentitySwitcher } from "@/components/app/identity-switcher";
import type { Identity } from "@/modules/identity/identities";

/**
 * Gates the full-width {@link IdentitySwitcher} row to the dashboard. On any
 * other route it renders nothing — including its spacing wrapper, so non-
 * dashboard pages get no leftover gap. Off the dashboard, role switching lives
 * in the navbar account menu instead (see {@link AccountMenu}).
 */
export function DashboardIdentityRow({
  identities,
  current,
  className,
}: {
  identities: Identity[];
  current: Identity | null;
  className?: string;
}) {
  const pathname = usePathname();
  if (!pathname.startsWith("/dashboard")) return null;

  return (
    <div className={className}>
      <IdentitySwitcher identities={identities} current={current} />
    </div>
  );
}
