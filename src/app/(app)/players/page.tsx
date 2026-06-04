import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { listTeams } from "@/modules/clubs/service";
import { listPlayers } from "@/modules/roster/service";

import { StatusBadge } from "../seasons/season-forms";
import { CreatePlayerForm } from "./player-create-form";

export default async function PlayersPage() {
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN", "COACH");
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const clubId = ctx.activeClubId;
  const isCoach = ctx.role === "COACH";
  const canCreate = can(ctx, "players.create", { clubId });
  const [players, teams] = await Promise.all([listPlayers(ctx, clubId), listTeams(ctx, clubId)]);
  const teamOptions = teams
    .filter((t) => t.status !== "ARCHIVED")
    .map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Players</h1>
      <p className="mt-1 text-muted-foreground">
        {isCoach ? "Players on the teams you coach." : "The players registered in your club."}
      </p>

      {canCreate ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-sport text-base">Add a player</CardTitle>
          </CardHeader>
          <CardContent>
            {isCoach && teamOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You aren&apos;t assigned to any teams yet, so you can&apos;t add players.
              </p>
            ) : (
              <CreatePlayerForm teams={teamOptions} teamRequired={isCoach} />
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {players.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            {canCreate ? "No players yet. Add your first player above." : "No players to show."}
          </p>
        ) : (
          players.map((p) => (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-primary"
            >
              <div>
                <p className="font-sport text-base font-bold text-foreground">
                  {p.firstName} {p.lastName}
                  {p.jerseyNumber ? <span className="ml-2 text-muted-foreground">#{p.jerseyNumber}</span> : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  {p.teamMemberships.length > 0
                    ? p.teamMemberships.map((m) => m.team.name).join(", ")
                    : "No team"}
                  {p.primaryPosition ? ` · ${p.primaryPosition}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {p._count.parentLinks} {p._count.parentLinks === 1 ? "parent" : "parents"}
                </span>
                <StatusBadge status={p.status} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
