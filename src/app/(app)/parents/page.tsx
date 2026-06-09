import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { CopyInviteLinkButton } from "@/components/app/copy-invite-link-button";
import { ListContainer } from "@/components/console";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { copyParentInviteLinkAction } from "@/modules/roster/actions";
import { listParents, listPendingParentInvitations } from "@/modules/roster/service";

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
    <div className="mx-auto min-w-0 max-w-3xl">
      <h1 className="font-display text-2xl uppercase tracking-tight text-foreground wrap-break-word sm:text-3xl">Parents</h1>
      <p className="mt-1 text-muted-foreground">
        View parents and guardians and link them to their children. Parents are invited from a player&apos;s
        roster — open a player and use its <span className="font-medium">Guardians</span> section to invite one.
      </p>

      {pending.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-sport text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {pending.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
                  <span className="text-foreground">{inv.email}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <CopyInviteLinkButton invitationId={inv.id} action={copyParentInviteLinkAction} />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Pending</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6">
        {parents.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No parents have joined yet. Invite one from a player&apos;s Guardians section.
          </p>
        ) : (
          <ListContainer>
            {parents.map((p) => (
              <Link
                key={p.id}
                href={`/parents/${p.id}`}
                className="group flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-xs ring-1 ring-transparent transition-all hover:border-primary hover:shadow-sm hover:ring-primary/10"
              >
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                >
                  {(p.firstName[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sport text-sm font-bold text-foreground">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {p._count.playerLinks} {p._count.playerLinks === 1 ? "child" : "children"}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
                </div>
              </Link>
            ))}
          </ListContainer>
        )}
      </div>
    </div>
  );
}
