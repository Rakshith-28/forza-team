import { DashboardPlaceholder } from "@/components/app/dashboard-placeholder";
import { requireRole } from "@/lib/auth-guards";

export default async function CoachDashboard() {
  await requireRole("COACH");
  return (
    <DashboardPlaceholder
      title="Coach"
      subtitle="Your assigned teams."
      cards={[
        { title: "Team Roster", description: "Full roster for your assigned teams." },
        { title: "Schedule & Attendance", description: "Run practices and record attendance." },
        { title: "Announcements & Chat", description: "Communicate with your teams." },
        { title: "Evaluations", description: "Score players and track development." },
      ]}
    />
  );
}
