import Link from "next/link";

import { PageHeader, StatusBadge, SummaryCard } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { getPlatformAnnouncementsSummary } from "@/modules/announcements/platform-service";
import { getMasterClubs, getMasterDashboardSummary } from "@/modules/master/service";

import { ClubsPanel } from "./clubs-panel";
import { SystemSnapshot } from "./system-snapshot";
import { SeverityBadge } from "../../platform-announcements/severity-badge";

export default async function AdminDashboard() {
  const ctx = await requireRole("MASTER_ADMIN");
  const [summary, clubs, announcements] = await Promise.all([
    getMasterDashboardSummary(ctx),
    getMasterClubs(ctx, { pageSize: 12 }),
    getPlatformAnnouncementsSummary(ctx),
  ]);

  // Three headline counts get prominent cards; everything else is condensed
  // into a single "System snapshot" panel so the dashboard isn't a wall of cards.
  const headline: { label: string; value: number; href?: string }[] = [
    { label: "Clubs", value: summary.clubs, href: "/clubs" },
    { label: "Teams", value: summary.teams },
    { label: "Players", value: summary.players },
  ];

  const snapshot: { label: string; value: number; href?: string }[] = [
    { label: "Active clubs", value: summary.activeClubs },
    { label: "Coaches", value: summary.coaches, href: "/coaches" },
    { label: "Players", value: summary.playerAccounts },
    { label: "Users", value: summary.users, href: "/users" },
    { label: "Open invoices", value: summary.openInvoices },
    { label: "Overdue invoices", value: summary.overdueInvoices },
    { label: "Upcoming events", value: summary.upcomingEvents },
    { label: "Active eval cycles", value: summary.activeEvaluationCycles },
    { label: "Waiver acceptances", value: summary.waiverAcceptances },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Master Admin" description="System-wide overview across all clubs." />

      <section className="mt-6">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {headline.map((s) => (
            <SummaryCard
              key={s.label}
              label={s.label}
              value={s.value}
              href={s.href}
              labelPosition="top"
              labelTone="green"
              className="p-4 sm:p-5"
            />
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-sport text-base font-bold tracking-tight text-foreground">System snapshot</h2>
        <SystemSnapshot items={snapshot} />
      </section>

      <section className="mt-8 rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-sport text-lg font-bold tracking-tight text-foreground">Platform announcements</h2>
          <Link href="/platform-announcements" className="text-sm font-medium text-primary hover:underline">
            Manage
          </Link>
        </div>
        {announcements.recent.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No broadcasts yet. Create one to notify clubs.
          </p>
        ) : (
          <ul className="divide-y">
            {announcements.recent.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <SeverityBadge severity={a.severity} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{a.title}</span>
                <StatusBadge status={a.status} />
                <span className="shrink-0 text-xs text-muted-foreground">{a.reads} reads</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{announcements.totalLive} live right now</p>
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
