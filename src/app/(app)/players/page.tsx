import { requireRole } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { listTeams } from "@/modules/clubs/service";
import { listPlayers } from "@/modules/roster/service";

import { PlayersBrowser, type PlayerListItem } from "./players-browser";

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
  // A coach scopes to their ACTIVE team only; with none selected the roster is
  // intentionally empty (never a union across teams) — prompt them to pick.
  const coachNoActiveTeam = isCoach && !ctx.activeTeamId;
  const canCreate = can(ctx, "players.create", { clubId });
  const [players, teams] = await Promise.all([listPlayers(ctx, clubId), listTeams(ctx, clubId)]);
  const teamOptions = teams
    .filter((t) => t.status !== "ARCHIVED")
    .map((t) => ({ id: t.id, name: t.name }));

  const description = isCoach ? "Players on the teams you coach." : "The players registered in your club.";

  const items: PlayerListItem[] = players.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    jerseyNumber: p.jerseyNumber,
    primaryPosition: p.primaryPosition,
    teamNames: p.teamMemberships.map((m) => m.team.name),
    playerCount: p._count.accountLinks,
    status: p.status,
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString() : null,
  }));

  return (
    <PlayersBrowser
      players={items}
      description={description}
      canCreate={canCreate}
      isCoach={isCoach}
      teamOptions={teamOptions}
      teamRequired={isCoach}
      emptyMessage={coachNoActiveTeam ? "Select a team to view its roster." : undefined}
    />
  );
}
