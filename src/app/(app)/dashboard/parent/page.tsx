import { DashboardPlaceholder } from "@/components/app/dashboard-placeholder";
import { requireRole } from "@/lib/auth-guards";

export default async function ParentDashboard() {
  await requireRole("PARENT");
  return (
    <DashboardPlaceholder
      title="My Kids"
      subtitle="Your linked children and their teams."
      cards={[
        { title: "Child Profiles", description: "View your children's profiles and schedules." },
        { title: "Team Roster", description: "Safe roster view for your children's teams." },
        { title: "RSVP & Attendance", description: "Respond to events and see attendance." },
        { title: "Payments & Waivers", description: "Your family's invoices and waivers." },
      ]}
    />
  );
}
