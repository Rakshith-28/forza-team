import { StatusBadge } from "@/components/console";
import type { ClubAdminState } from "@/modules/master/service";

/**
 * Orphan-club indicator. Renders an amber badge when a club has no active Club
 * Admin ("No admin") or only a pending invite ("Admin pending"); nothing when
 * healthy. Reuses the shared StatusBadge with an amber tone override.
 */
export function ClubAdminBadge({ state }: { state: ClubAdminState }) {
  if (state === "ok") return null;
  const label = state === "pending" ? "Admin pending" : "No admin";
  return <StatusBadge status={label} className="bg-amber-100 text-amber-700" />;
}
