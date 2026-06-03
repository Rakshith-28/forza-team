import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { requireAuthContext } from "@/lib/auth-guards";
import { listChatTeams } from "@/modules/comms/service";

export default async function ChatHomePage() {
  const ctx = await requireAuthContext();
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const teams = await listChatTeams(ctx);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Team Chat</h1>
      <p className="mt-1 text-muted-foreground">Conversations for your teams.</p>

      <div className="mt-6 flex flex-col gap-3">
        {teams.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No team conversations available to you yet.
          </p>
        ) : (
          teams.map((t) => (
            <Link key={t.id} href={`/chat/${t.id}`}>
              <Card className="transition-colors hover:border-primary">
                <CardContent className="py-4">
                  <p className="font-sport text-base font-bold text-foreground">{t.name}</p>
                  <p className="text-sm text-muted-foreground">Team conversation</p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
