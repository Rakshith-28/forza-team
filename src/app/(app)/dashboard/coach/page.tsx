import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnnouncementsPanel, type AnnouncementPanelItem } from "@/components/app/announcements-panel";
import { CoachQuickTiles } from "@/components/app/coach-quick-tiles";
import { UpcomingEventsCarousel } from "@/components/app/upcoming-events-carousel";
import { loadIdentitySwitcher, requireRole } from "@/lib/auth-guards";
import { getMyPlatformAnnouncements } from "@/modules/announcements/platform-service";
import { listMyRecentClubAnnouncements } from "@/modules/comms/service";
import {
  countEventsNeedingAttendance,
  getCoachAttendanceOverview,
  listUpcomingEvents,
} from "@/modules/events/service";
import { formatEventDateChip } from "@/modules/events/format";
import { countEvaluationsToComplete } from "@/modules/evaluations/service";
import { getCoachRosterPreview } from "@/modules/roster/service";

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
  const [upcoming, needsAttendance, evalsToComplete, platform, club, identity, rosterPreview, attendance] =
    await Promise.all([
      listUpcomingEvents(ctx, clubId, 6),
      countEventsNeedingAttendance(ctx, clubId),
      countEvaluationsToComplete(ctx, clubId),
      getMyPlatformAnnouncements(ctx),
      listMyRecentClubAnnouncements(ctx, 10),
      loadIdentitySwitcher(ctx.userId),
      getCoachRosterPreview(ctx, clubId),
      getCoachAttendanceOverview(ctx, clubId),
    ]);

  // Next few upcoming dates for the Schedule tile's mini calendar chips.
  const scheduleChips = upcoming.slice(0, 3).map((e) => {
    const chip = formatEventDateChip(e.startAt, e.timezone);
    return { id: e.id, month: chip.month, day: chip.day };
  });

  // Serializable slides for the upcoming-events carousel (flatten event_teams → teams).
  const upcomingSlides = upcoming.map((e) => ({
    id: e.id,
    title: e.title,
    eventType: e.eventType,
    startAt: e.startAt.toISOString(),
    timezone: e.timezone,
    locationName: e.locationName,
    teams: e.eventTeams.map((et) => ({ id: et.team.id, name: et.team.name })),
  }));

  // Title the dashboard with the team the coach is acting on (falls back to the
  // club name, then "Coach" if no specific identity context is available).
  const heading = identity.current?.contextLabel ?? "Coach";
  const subheading = identity.current?.clubName
    ? `Coach · ${identity.current.clubName}`
    : "Your assigned teams at a glance.";

  // Merge platform broadcasts + the coach's club/team announcements into one feed.
  const announcementItems: AnnouncementPanelItem[] = [
    ...platform.map((p) => ({
      id: p.id,
      source: "platform" as const,
      title: p.title,
      body: p.body,
      badge: p.severity,
      pinned: p.pinned,
      read: p.read,
      date: p.publishedAt,
    })),
    ...club.map((c) => ({
      id: c.id,
      source: "club" as const,
      title: c.title,
      body: c.body,
      badge: c.audienceType,
      pinned: c.pinned,
      important: c.important,
      read: c.read,
      date: c.publishedAt,
    })),
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">{heading}</h1>
      <p className="mt-1 text-muted-foreground">{subheading}</p>

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
            <UpcomingEventsCarousel events={upcomingSlides} />
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <AnnouncementsPanel items={announcementItems} />
      </div>

      <div className="mt-6">
        <CoachQuickTiles
          roster={{ href: "/players", count: rosterPreview.count, avatars: rosterPreview.avatars }}
          schedule={{ href: "/schedule", matchCount: upcoming.length, chips: scheduleChips }}
          attendance={{
            href: "/attendance",
            avgPct: attendance.avgPct,
            lastPct: attendance.lastPct,
            series: attendance.series,
          }}
        />
      </div>
    </div>
  );
}
