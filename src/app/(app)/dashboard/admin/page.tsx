import Link from "next/link";

import { PageHeader, SummaryCard } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { getMasterClubs, getMasterDashboardSummary } from "@/modules/master/service";

import { ClubsPanel } from "./clubs-panel";

export default async function AdminDashboard() {
  const ctx = await requireRole("MASTER_ADMIN");
  const [summary, clubs] = await Promise.all([
    getMasterDashboardSummary(ctx),
    getMasterClubs(ctx, { pageSize: 12 }),
  ]);

  const stats: { label: string; value: number; href?: string }[] = [
    { label: "Clubs", value: summary.clubs, href: "/clubs" },
    { label: "Active Clubs", value: summary.activeClubs, href: "/clubs" },
    { label: "Teams", value: summary.teams },
    { label: "Players", value: summary.players },
    { label: "Coaches", value: summary.coaches, href: "/coaches" },
    { label: "Parents", value: summary.parents },
    { label: "Users", value: summary.users, href: "/users" },
    { label: "Open Invoices", value: summary.openInvoices },
    { label: "Overdue Invoices", value: summary.overdueInvoices },
    { label: "Upcoming Events", value: summary.upcomingEvents },
    { label: "Active Eval Cycles", value: summary.activeEvaluationCycles },
    { label: "Waiver Acceptances", value: summary.waiverAcceptances },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Master Admin" description="System-wide overview across all clubs." />

      <section className="mt-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((s) => (
            <SummaryCard
              key={s.label}
              label={s.label}
              value={s.value}
              href={s.href}
              labelPosition="top"
              labelTone="green"
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-sport text-lg font-bold tracking-tight text-foreground">Clubs</h2>
          <Link href="/clubs" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <ClubsPanel clubs={clubs.rows} />
      </section>
    </div>
  );
}
