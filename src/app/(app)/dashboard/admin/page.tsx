import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { getSystemSummary } from "@/modules/clubs/service";

export default async function AdminDashboard() {
  const ctx = await requireRole("MASTER_ADMIN");
  const summary = await getSystemSummary(ctx);

  const stats = [
    { label: "Clubs", value: summary.clubCount, href: "/clubs" },
    { label: "Teams", value: summary.teamCount, href: "/clubs" },
    { label: "Players", value: summary.playerCount, href: "/clubs" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Master Admin</h1>
      <p className="mt-1 text-muted-foreground">System-wide overview across all clubs.</p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:border-primary">
              <CardContent className="pt-6">
                <p className="font-sport text-3xl font-extrabold text-foreground">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/clubs">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="font-sport text-base">Clubs</CardTitle>
              <CardDescription>Create and manage every club on the platform.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="font-sport text-base text-muted-foreground">Users &amp; audit</CardTitle>
            <CardDescription>Account management and audit trail arrive in a later phase.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
