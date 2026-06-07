import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/console/tabs";
import { ScheduleView } from "@/components/schedule/schedule-view";
import { PhotoUpload } from "@/components/app/photo-upload";
import { requireRole } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { listTeams } from "@/modules/clubs/service";
import { archivePlayerAction, removeGuardianAction, removeMembershipAction } from "@/modules/roster/actions";
import { getPlayer, listPlayerGuardians } from "@/modules/roster/service";
import { getClubTimezone, listScheduleEvents } from "@/modules/events/service";
import { scheduleWindow } from "@/modules/events/schedule-window";
import { RELATIONSHIP_LABELS } from "@/modules/roster/schemas";

import { StatusBadge } from "../../seasons/season-forms";
import { AddMembershipForm, PlayerEditSection } from "./player-detail-client";
import { InviteGuardianForm, LinkExistingGuardianForm } from "./guardian-forms";

function relLabel(t: string): string {
  return RELATIONSHIP_LABELS[t as keyof typeof RELATIONSHIP_LABELS] ?? t;
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function PlayerDetailPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN", "COACH");

  const player = await getPlayer(ctx, playerId);
  if (!player) notFound();

  const canEdit = can(ctx, "players.edit_full", { clubId: player.clubId, playerId });
  const guardians = await listPlayerGuardians(ctx, playerId);
  const teams = canEdit ? await listTeams(ctx, player.clubId) : [];
  const memberTeamIds = new Set(player.teamMemberships.map((m) => m.teamId));
  const addableTeams = teams
    .filter((t) => t.status !== "ARCHIVED" && !memberTeamIds.has(t.id))
    .map((t) => ({ id: t.id, name: t.name }));

  // Schedule tab: events on this player's teams (+ club-wide).
  const tz = await getClubTimezone(ctx, player.clubId);
  const { todayKey, month, from, to } = scheduleWindow(new Date(), tz);
  const playerEvents = await listScheduleEvents({
    actor: ctx,
    from,
    to,
    filters: { teamIds: [...memberTeamIds] },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/players" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← All players
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">
            {player.firstName} {player.lastName}
            {player.preferredName ? (
              <span className="ml-2 text-xl text-muted-foreground">&ldquo;{player.preferredName}&rdquo;</span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {player.jerseyNumber ? `#${player.jerseyNumber}` : "No number"}
            {player.primaryPosition ? ` · ${player.primaryPosition}` : ""}
            {player.secondaryPosition ? ` / ${player.secondaryPosition}` : ""}
            {` · DOB ${fmtDate(player.dateOfBirth)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={player.status} />
          {canEdit ? (
            <Link
              href={`/evaluations/evaluate/${player.id}`}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
            >
              Evaluate
            </Link>
          ) : null}
          {canEdit ? <PlayerEditSection player={toEditData(player)} /> : null}
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
      <Card>
        <CardHeader>
          <CardTitle className="font-sport text-base">Photo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {player.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.photoUrl} alt={`${player.firstName} ${player.lastName}`} className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-secondary-foreground">
              {player.firstName.slice(0, 1)}
            </span>
          )}
          {canEdit ? <PhotoUpload playerId={player.id} /> : null}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Sensitive details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Emergency contact" value={player.emergencyContactName} />
          <Detail label="Emergency phone" value={player.emergencyContactPhone} />
          <Detail label="Medical notes" value={player.medicalNotes} />
          <Detail label="Allergy notes" value={player.allergyNotes} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Teams</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {player.teamMemberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not on any team yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {player.teamMemberships.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
                  <div>
                    <p className="font-medium text-foreground">{m.team.name}</p>
                    {m.season ? (
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.season.name}</p>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <form action={removeMembershipAction}>
                      <input type="hidden" name="playerId" value={player.id} />
                      <input type="hidden" name="membershipId" value={m.id} />
                      <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-destructive">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canEdit ? (
            <div className="border-t pt-4">
              <AddMembershipForm playerId={player.id} teams={addableTeams} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Guardians</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {guardians.links.length === 0 && guardians.pendingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No parents linked yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {guardians.links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {l.parent.firstName} {l.parent.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="uppercase tracking-wide">{relLabel(l.relationshipType)}</span>
                      {l.canPickup ? " · can pick up" : ""}
                      {l.canPay ? " · can pay" : ""}
                    </p>
                  </div>
                  {canEdit ? (
                    <form action={removeGuardianAction}>
                      <input type="hidden" name="playerId" value={player.id} />
                      <input type="hidden" name="linkId" value={l.id} />
                      <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-destructive">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
              {guardians.pendingInvites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-card p-3">
                  <span className="text-sm text-foreground">{inv.email}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Pending
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canEdit ? (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <InviteGuardianForm playerId={player.id} />
              <LinkExistingGuardianForm playerId={player.id} />
            </div>
          ) : null}
        </CardContent>
      </Card>

          {canEdit && player.status !== "ARCHIVED" ? (
            <form action={archivePlayerAction} className="mt-6">
              <input type="hidden" name="playerId" value={player.id} />
              <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-destructive">
                Archive this player
              </button>
            </form>
          ) : null}
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleView
            events={playerEvents}
            today={todayKey}
            initialMonth={month}
            initialSelectedDate={todayKey}
            detailHref={(id) => `/schedule/${id}`}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type PlayerRecord = NonNullable<Awaited<ReturnType<typeof getPlayer>>>;

function toEditData(p: PlayerRecord) {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    preferredName: p.preferredName,
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
    jerseyNumber: p.jerseyNumber,
    primaryPosition: p.primaryPosition,
    secondaryPosition: p.secondaryPosition,
    emergencyContactName: p.emergencyContactName,
    emergencyContactPhone: p.emergencyContactPhone,
    medicalNotes: p.medicalNotes,
    allergyNotes: p.allergyNotes,
    status: p.status,
  };
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground">{value || "—"}</p>
    </div>
  );
}
