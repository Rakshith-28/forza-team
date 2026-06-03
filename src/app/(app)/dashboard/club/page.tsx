import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { getClub, getClubSummary } from "@/modules/clubs/service";
import { countEventsNeedingAttendance, listUpcomingEvents } from "@/modules/events/service";
import { EVENT_TYPE_LABELS, type EventType } from "@/modules/events/schemas";
import { formatEventTime } from "@/modules/events/format";

import { ClubNameForm } from "../../clubs/club-forms";

export default async function ClubDashboard() {
  const ctx = await requireRole("CLUB_ADMIN");
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const clubId = ctx.activeClubId;
  const [club, summary, upcoming, needsAttendance] = await Promise.all([
    getClub(ctx, clubId),
    getClubSummary(ctx, clubId),
    listUpcomingEvents(ctx, clubId, 5),
    countEventsNeedingAttendance(ctx, clubId),
  ]);

  const stats = [
    { label: "Teams", value: summary.teamCount, href: "/teams" },
    { label: "Players", value: summary.playerCount, href: "/players" },
    { label: "Active seasons", value: summary.activeSeasonCount, href: "/seasons" },
    { label: "Coaches assigned", value: summary.coachCount, href: "/teams" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">
            {club?.name ?? "Club"}
          </h1>
          <p className="mt-1 text-muted-foreground">Your club at a glance.</p>
        </div>
        {club ? (
          <ClubNameForm key={club.updatedAt.toISOString()} clubId={club.id} name={club.name} />
        ) : null}
      </div>

      {needsAttendance > 0 ? (
        <Link href="/schedule">
          <Card className="mt-6 border-primary/40 transition-colors hover:border-primary">
            <CardContent className="py-4">
              <p className="text-sm font-medium text-foreground">
                {needsAttendance} past {needsAttendance === 1 ? "event needs" : "events need"} attendance recorded →
              </p>
            </CardContent>
          </Card>
        </Link>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:border-primary">
              <CardContent className="pt-6">
                <p className="font-sport text-3xl font-extrabold text-foreground">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/seasons">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="font-sport text-base">Seasons</CardTitle>
              <CardDescription>Create and manage the seasons your teams play in.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/teams">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="font-sport text-base">Teams</CardTitle>
              <CardDescription>Build teams, set details, and assign coaching staff.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Upcoming events</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming events. <Link href="/schedule" className="underline">Open the schedule</Link>.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/schedule/${e.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary"
                  >
                    <div>
                      <p className="font-medium text-foreground">{e.title}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {EVENT_TYPE_LABELS[e.eventType as EventType] ?? e.eventType}
                        {e.team ? ` · ${e.team.name}` : " · Club-wide"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatEventTime(e.startAt, e.timezone)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
