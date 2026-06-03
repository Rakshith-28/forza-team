import { DashboardPlaceholder } from "@/components/app/dashboard-placeholder";
import { requireRole } from "@/lib/auth-guards";

export default async function AdminDashboard() {
  await requireRole("MASTER_ADMIN");
  return (
    <DashboardPlaceholder
      title="Master Admin"
      subtitle="System-wide overview across all clubs."
      cards={[
        { title: "Clubs", description: "Create and manage every club on the platform." },
        { title: "Users", description: "Manage accounts and role assignments." },
        { title: "Audit Logs", description: "Full system-wide audit trail." },
        { title: "System Settings", description: "Platform-level configuration." },
      ]}
    />
  );
}
