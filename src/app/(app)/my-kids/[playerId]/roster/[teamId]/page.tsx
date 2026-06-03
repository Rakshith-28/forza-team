import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import { getOwnChild, listSafeTeamRoster } from "@/modules/roster/service";
import type { SafePlayer } from "@/modules/roster/projections";

export default async function ParentTeamRosterPage({
  params,
}: {
  params: Promise<{ playerId: string; teamId: string }>;
}) {
  const { playerId, teamId } = await params;
  const ctx = await requireRole("PARENT");

  const child = await getOwnChild(ctx, playerId);
  if (!child) notFound();
  const team = child.teams.find((t) => t.id === teamId);
  if (!team) notFound();

  let roster: SafePlayer[];
  try {
    roster = await listSafeTeamRoster(ctx, teamId);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/my-kids/${playerId}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← {child.displayName}
      </Link>

      <h1 className="mt-3 font-display text-3xl uppercase tracking-tight text-foreground">{team.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Team roster. Other families&apos; private details are not shown.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Players</CardTitle>
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">No players on this team yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {roster.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                      {p.displayName.slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <p className="font-medium text-foreground">
                      {p.displayName}
                      {p.jerseyNumber ? <span className="ml-2 text-muted-foreground">#{p.jerseyNumber}</span> : null}
                    </p>
                    {p.primaryPosition ? (
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.primaryPosition}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
