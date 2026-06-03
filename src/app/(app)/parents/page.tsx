import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { listParents, listPendingParentInvitations } from "@/modules/roster/service";

import { InviteParentForm } from "./parent-forms";

export default async function ParentsPage() {
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN");
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const clubId = ctx.activeClubId;
  const [parents, pending] = await Promise.all([
    listParents(ctx, clubId),
    listPendingParentInvitations(ctx, clubId),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Parents</h1>
      <p className="mt-1 text-muted-foreground">
        Invite parents and guardians, then link them to their children.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Invite a parent</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteParentForm />
          <p className="mt-3 text-xs text-muted-foreground">
            The parent sets their password via the invite link; their profile is created on acceptance, after
            which you can link their children.
          </p>
        </CardContent>
      </Card>

      {pending.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-sport text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {pending.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                  <span className="text-foreground">{inv.email}</span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Pending</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {parents.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No parents have joined yet. Invite one above.
          </p>
        ) : (
          parents.map((p) => (
            <Link
              key={p.id}
              href={`/parents/${p.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-primary"
            >
              <div>
                <p className="font-sport text-base font-bold text-foreground">
                  {p.firstName} {p.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{p.email}</p>
              </div>
              <span className="text-sm text-muted-foreground">
                {p._count.playerLinks} {p._count.playerLinks === 1 ? "child" : "children"}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
