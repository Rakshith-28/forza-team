import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/console/tabs";
import { ScheduleView } from "@/components/schedule/schedule-view";
import { requireRole } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { listTeams } from "@/modules/clubs/service";
import { CopyInviteLinkButton } from "@/components/app/copy-invite-link-button";
import { DeleteConfirmDialog } from "@/components/console";
import { copyPlayerAccountInviteLinkAction, deletePlayerAction, removeGuardianAction, removeMembershipAction } from "@/modules/roster/actions";
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
  const canDelete = can(ctx, "player.delete", { clubId: player.clubId });
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
    <div className="mx-auto min-w-0 max-w-6xl">
      <Link href="/players" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← All players
      </Link>

      {/* Hero */}
      <div data-glass className="mt-3 flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {player.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.photoUrl}
              alt={`${player.firstName} ${player.lastName}`}
              className="size-16 shrink-0 rounded-full object-cover ring-2 ring-secondary sm:size-20"
            />
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground ring-2 ring-secondary sm:size-20">
              {player.firstName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl uppercase tracking-tight text-foreground wrap-break-word sm:text-3xl">
              {player.firstName} {player.lastName}
              {player.preferredName ? (
                <span className="ml-2 text-lg text-muted-foreground sm:text-xl">&ldquo;{player.preferredName}&rdquo;</span>
              ) : null}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {player.jerseyNumber ? <Pill>#{player.jerseyNumber}</Pill> : null}
              {player.primaryPosition ? <Pill>{player.primaryPosition}</Pill> : null}
              {player.secondaryPosition ? <Pill muted>{player.secondaryPosition}</Pill> : null}
              <span className="text-xs text-muted-foreground">DOB {fmtDate(player.dateOfBirth)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
          <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:items-start">
            {/* Left column */}
            <div className="flex min-w-0 flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-sport text-base">Sensitive details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                  <Detail label="Emergency contact" value={player.emergencyContactName} />
                  <Detail label="Emergency phone" value={player.emergencyContactPhone} />
                  <Detail label="Medical notes" value={player.medicalNotes} />
                  <Detail label="Allergy notes" value={player.allergyNotes} />
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="flex min-w-0 flex-col gap-6">
              <Card>
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
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{m.team.name}</p>
                            {m.season ? (
                              <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{m.season.name}</p>
                            ) : null}
                          </div>
                          {canEdit ? (
                            <form action={removeMembershipAction} className="shrink-0">
                              <input type="hidden" name="playerId" value={player.id} />
                              <input type="hidden" name="membershipId" value={m.id} />
                              <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-destructive">
                                Remove from team
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

              <Card>
                <CardHeader>
                  <CardTitle className="font-sport text-base">Guardians</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {guardians.links.length === 0 && guardians.pendingInvites.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No players linked yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {guardians.links.map((l) => (
                        <li key={l.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {l.playerAccount.firstName} {l.playerAccount.lastName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              <span className="uppercase tracking-wide">{relLabel(l.relationshipType)}</span>
                              {l.canPickup ? " · can pick up" : ""}
                              {l.canPay ? " · can pay" : ""}
                            </p>
                          </div>
                          {canEdit ? (
                            <form action={removeGuardianAction} className="shrink-0">
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
                          <span className="min-w-0 truncate text-sm text-foreground">{inv.email}</span>
                          <div className="flex shrink-0 items-center gap-2">
                            {canEdit ? (
                              <CopyInviteLinkButton invitationId={inv.id} action={copyPlayerAccountInviteLinkAction} />
                            ) : null}
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                              Pending
                            </span>
                          </div>
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
            </div>
          </div>

          {canDelete ? (
            <div className="mt-8 flex min-w-0 flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
              <div className="min-w-0">
                <h2 className="font-sport text-base font-bold text-foreground">Danger zone</h2>
                <p className="mt-1 text-sm text-muted-foreground break-words">
                  Deleting a player is permanent and cannot be undone.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {(
                  <DeleteConfirmDialog
                    triggerLabel="Delete permanently"
                    title="Delete this player permanently?"
                    confirmPhrase={`${player.firstName} ${player.lastName}`}
                    action={deletePlayerAction}
                    fields={{ playerId: player.id }}
                    description={
                      <>
                        This permanently removes{" "}
                        <span className="font-semibold text-foreground">
                          {player.firstName} {player.lastName}
                        </span>{" "}
                        and all of their memberships, evaluations, attendance, development goals, remarks, RSVPs and
                        guardian links. Team and guardian records are not deleted.{" "}
                        <span className="font-semibold text-foreground">This cannot be undone.</span>
                      </>
                    }
                  />
                )}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleView
            events={playerEvents}
            today={todayKey}
            initialMonth={month}
            initialSelectedDate={todayKey}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Pill({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide ring-1 ring-inset ${
        muted
          ? "bg-secondary text-secondary-foreground ring-border"
          : "bg-primary/10 text-primary ring-primary/20"
      }`}
    >
      {children}
    </span>
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
