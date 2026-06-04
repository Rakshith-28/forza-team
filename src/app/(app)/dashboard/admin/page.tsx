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
    { label: "Parents", value: summary.parents },
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {headline.map((s) => (
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

      <section className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-sport text-base font-bold tracking-tight text-foreground">System snapshot</h2>
        <dl className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {snapshot.map((s) => {
            const row = (
              <div className="flex items-center justify-between border-b border-border/60 py-2">
                <dt className="text-sm text-muted-foreground">{s.label}</dt>
                <dd className="font-sport text-lg font-bold tabular-nums text-foreground">{s.value}</dd>
              </div>
            );
            return s.href ? (
              <Link key={s.label} href={s.href} className="rounded-md transition-colors hover:text-primary [&_dt]:hover:text-primary">
                {row}
              </Link>
            ) : (
              <div key={s.label}>{row}</div>
            );
          })}
        </dl>
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
