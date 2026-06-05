import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformAnnouncementsPanel } from "@/components/app/platform-announcements-panel";
import { requireRole } from "@/lib/auth-guards";
import { getMyPlatformAnnouncements, getMyUnreadPlatformAnnouncementCount } from "@/modules/announcements/platform-service";
import { countEventsNeedingAttendance, listUpcomingEvents } from "@/modules/events/service";
import { EVENT_TYPE_LABELS, type EventType } from "@/modules/events/schemas";
import { formatEventTime } from "@/modules/events/format";
import { countEvaluationsToComplete } from "@/modules/evaluations/service";

export default async function CoachDashboard() {
  const ctx = await requireRole("COACH");
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const clubId = ctx.activeClubId;
  const [upcoming, needsAttendance, evalsToComplete, announcements, unread] = await Promise.all([
    listUpcomingEvents(ctx, clubId, 6),
    countEventsNeedingAttendance(ctx, clubId),
    countEvaluationsToComplete(ctx, clubId),
    getMyPlatformAnnouncements(ctx),
    getMyUnreadPlatformAnnouncementCount(ctx),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Coach</h1>
      <p className="mt-1 text-muted-foreground">Your assigned teams at a glance.</p>

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

      {evalsToComplete > 0 ? (
        <Link href="/evaluations">
          <Card className="mt-3 border-primary/40 transition-colors hover:border-primary">
            <CardContent className="py-4">
              <p className="text-sm font-medium text-foreground">
                {evalsToComplete} {evalsToComplete === 1 ? "player" : "players"} still to evaluate this cycle →
              </p>
            </CardContent>
          </Card>
        </Link>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Upcoming events</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming events. <Link href="/schedule/new" className="underline">Create one</Link>.
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

      <div className="mt-6">
        <PlatformAnnouncementsPanel items={announcements} unread={unread} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/players">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="font-sport text-base">Team Roster</CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/schedule">
          <Card className="h-full transition-colors hover:border-primary">
            <CardHeader>
              <CardTitle className="font-sport text-base">Schedule &amp; Attendance</CardTitle>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
