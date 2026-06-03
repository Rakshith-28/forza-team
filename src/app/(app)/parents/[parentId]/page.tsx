import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { listPlayers, getParent } from "@/modules/roster/service";
import { unlinkParentAction } from "@/modules/roster/actions";

import { LinkChildForm, ParentEditForm } from "../parent-forms";

export default async function ParentDetailPage({ params }: { params: Promise<{ parentId: string }> }) {
  const { parentId } = await params;
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN");

  const parent = await getParent(ctx, parentId);
  if (!parent) notFound();

  const linkedPlayerIds = new Set(parent.playerLinks.map((l) => l.player.id));
  const allPlayers = await listPlayers(ctx, parent.clubId);
  const linkable = allPlayers
    .filter((p) => !linkedPlayerIds.has(p.id))
    .map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/parents" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← All parents
      </Link>

      <h1 className="mt-3 font-display text-3xl uppercase tracking-tight text-foreground">
        {parent.firstName} {parent.lastName}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{parent.email}</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Linked children</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {parent.playerLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No children linked yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {parent.playerLinks.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
                  <div>
                    <Link href={`/players/${l.player.id}`} className="font-medium text-foreground hover:underline">
                      {l.player.firstName} {l.player.lastName}
                    </Link>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{l.relationshipType}</p>
                  </div>
                  <form action={unlinkParentAction}>
                    <input type="hidden" name="parentId" value={parent.id} />
                    <input type="hidden" name="linkId" value={l.id} />
                    <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-destructive">
                      Unlink
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t pt-4">
            <LinkChildForm parentId={parent.id} players={linkable} />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Contact &amp; profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ParentEditForm
            parent={{
              id: parent.id,
              firstName: parent.firstName,
              lastName: parent.lastName,
              phone: parent.phone,
              secondaryPhone: parent.secondaryPhone,
              preferredContactMethod: parent.preferredContactMethod,
              addressLine1: parent.addressLine1,
              addressLine2: parent.addressLine2,
              city: parent.city,
              state: parent.state,
              postalCode: parent.postalCode,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
