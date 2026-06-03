import { DashboardPlaceholder } from "@/components/app/dashboard-placeholder";
import { requireRole } from "@/lib/auth-guards";

export default async function ClubDashboard() {
  await requireRole("CLUB_ADMIN");
  return (
    <DashboardPlaceholder
      title="Club Admin"
      subtitle="Everything within your club."
      cards={[
        { title: "Teams & Seasons", description: "Build out your club structure." },
        { title: "Players & Parents", description: "Manage the roster and families." },
        { title: "Schedule & Attendance", description: "Events, RSVPs, and attendance." },
        { title: "Billing & Waivers", description: "Invoices, payments, compliance." },
        { title: "Evaluations", description: "Templates, cycles, and player scores." },
        { title: "Reports", description: "Club-wide attendance and evaluation reports." },
      ]}
    />
  );
}
