import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { listPlayers, getPlayerAccount } from "@/modules/roster/service";
import { unlinkPlayerAccountAction } from "@/modules/roster/actions";

import { LinkChildForm, PlayerAccountEditForm } from "../player-account-forms";

export default async function PlayerAccountDetailPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN");

  const playerAccount = await getPlayerAccount(ctx, accountId);
  if (!playerAccount) notFound();

  const linkedPlayerIds = new Set(playerAccount.playerLinks.map((l) => l.player.id));
  const allPlayers = await listPlayers(ctx, playerAccount.clubId);
  const linkable = allPlayers
    .filter((p) => !linkedPlayerIds.has(p.id))
    .map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/player-accounts" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← All players
      </Link>

      <h1 className="mt-3 font-display text-3xl uppercase tracking-tight text-foreground">
        {playerAccount.firstName} {playerAccount.lastName}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{playerAccount.email}</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Linked children</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {playerAccount.playerLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No children linked yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {playerAccount.playerLinks.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
                  <div>
                    <Link href={`/players/${l.player.id}`} className="font-medium text-foreground hover:underline">
                      {l.player.firstName} {l.player.lastName}
                    </Link>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{l.relationshipType}</p>
                  </div>
                  <form action={unlinkPlayerAccountAction}>
                    <input type="hidden" name="playerAccountId" value={playerAccount.id} />
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
            <LinkChildForm playerAccountId={playerAccount.id} players={linkable} />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Contact &amp; profile</CardTitle>
        </CardHeader>
        <CardContent>
          <PlayerAccountEditForm
            playerAccount={{
              id: playerAccount.id,
              firstName: playerAccount.firstName,
              lastName: playerAccount.lastName,
              phone: playerAccount.phone,
              secondaryPhone: playerAccount.secondaryPhone,
              preferredContactMethod: playerAccount.preferredContactMethod,
              addressLine1: playerAccount.addressLine1,
              addressLine2: playerAccount.addressLine2,
              city: playerAccount.city,
              state: playerAccount.state,
              postalCode: playerAccount.postalCode,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
