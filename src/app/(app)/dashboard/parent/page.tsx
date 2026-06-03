import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { listLinkedChildren } from "@/modules/roster/service";

export default async function ParentDashboard() {
  const ctx = await requireRole("PARENT");
  const children = await listLinkedChildren(ctx);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">My Kids</h1>
      <p className="mt-1 text-muted-foreground">
        Your linked children and their teams. Select a child to see their profile.
      </p>

      {children.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No children are linked to your account yet. Your club admin links children to your profile.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {children.map((c) => (
            <Link key={c.id} href={`/my-kids/${c.id}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle className="font-sport text-base">{c.displayName}</CardTitle>
                  <CardDescription>
                    {c.jerseyNumber ? `#${c.jerseyNumber}` : "No number"}
                    {c.primaryPosition ? ` · ${c.primaryPosition}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {c.teams.length > 0 ? c.teams.map((t) => t.name).join(", ") : "No team yet"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
