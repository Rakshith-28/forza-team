import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/console/tabs";
import { ScheduleView } from "@/components/schedule/schedule-view";
import { requireAuthContext } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { archiveTeamAction, removeCoachAction } from "@/modules/clubs/actions";
import { COACH_ROLE_LABELS } from "@/modules/clubs/schemas";
import { getTeam, listAssignableCoaches, listSeasons, listTeamCoaches } from "@/modules/clubs/service";
import { getClubTimezone, listScheduleEvents } from "@/modules/events/service";
import { scheduleWindow } from "@/modules/events/schedule-window";

import { StatusBadge } from "../../seasons/season-forms";
import { CoachAssignForm, TeamEditSection } from "./team-detail-client";

type CoachRoleType = keyof typeof COACH_ROLE_LABELS;

function coachName(u: { name: string | null; firstName: string; lastName: string; email: string }): string {
  return u.name?.trim() || `${u.firstName} ${u.lastName}`.trim() || u.email;
}

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const ctx = await requireAuthContext();

  const team = await getTeam(ctx, teamId);
  if (!team) notFound();

  const canManage = can(ctx, "teams.manage", { clubId: team.clubId, teamId });
  const tz = await getClubTimezone(ctx, team.clubId);
  const { todayKey, month, from, to } = scheduleWindow(new Date(), tz);
  const [coaches, seasons, assignable, teamEvents] = await Promise.all([
    listTeamCoaches(ctx, teamId),
    canManage ? listSeasons(ctx, team.clubId) : Promise.resolve([]),
    canManage ? listAssignableCoaches(ctx, team.clubId) : Promise.resolve([]),
    // CLUB_WIDE + events targeting this team.
    listScheduleEvents({ actor: ctx, from, to, filters: { teamId } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/teams" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← All teams
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">{team.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {team.teamCode}
            {team.season ? ` · ${team.season.name}` : ""}
            {team.ageGroup ? ` · ${team.ageGroup}` : ""}
            {team.division ? ` · ${team.division}` : ""}
            {team.competitiveLevel ? ` · ${team.competitiveLevel}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={team.status} />
          {canManage ? (
            <TeamEditSection
              key={team.updatedAt.toISOString()}
              team={{
                id: team.id,
                name: team.name,
                teamCode: team.teamCode,
                seasonId: team.seasonId,
                ageGroup: team.ageGroup,
                division: team.division,
                competitiveLevel: team.competitiveLevel,
                status: team.status,
              }}
              seasons={seasons.filter((s) => s.status !== "ARCHIVED").map((s) => ({ id: s.id, name: s.name }))}
            />
          ) : null}
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
          <CardTitle className="font-sport text-base">Coaching staff</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {coaches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No coaches assigned yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {coaches.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
                  <div>
                    <p className="font-medium text-foreground">{coachName(c.user)}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {COACH_ROLE_LABELS[c.roleType as CoachRoleType] ?? c.roleType}
                    </p>
                  </div>
                  {canManage ? (
                    <form action={removeCoachAction}>
                      <input type="hidden" name="teamId" value={team.id} />
                      <input type="hidden" name="userId" value={c.user.id} />
                      <button
                        type="submit"
                        className="text-sm font-medium text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {canManage ? (
            <div className="border-t pt-4">
              <CoachAssignForm
                teamId={team.id}
                assignable={assignable.map((u) => ({ id: u.id, label: coachName(u) }))}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

          {canManage && team.status !== "ARCHIVED" ? (
            <form action={archiveTeamAction} className="mt-6">
              <input type="hidden" name="teamId" value={team.id} />
              <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-destructive">
                Archive this team
              </button>
            </form>
          ) : null}
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleView
            events={teamEvents}
            today={todayKey}
            initialMonth={month}
            initialSelectedDate={todayKey}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
