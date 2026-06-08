import Link from "next/link";
import { CalendarDays, ClipboardCheck, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnnouncementsPanel, type AnnouncementPanelItem } from "@/components/app/announcements-panel";
import { UpcomingEvents } from "@/components/app/upcoming-events";
import { loadIdentitySwitcher, requireRole } from "@/lib/auth-guards";
import { getMyPlatformAnnouncements } from "@/modules/announcements/platform-service";
import { listMyRecentClubAnnouncements } from "@/modules/comms/service";
import { countEventsNeedingAttendance, listUpcomingEvents } from "@/modules/events/service";
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
  const [upcoming, needsAttendance, evalsToComplete, platform, club, identity] = await Promise.all([
    listUpcomingEvents(ctx, clubId, 6),
    countEventsNeedingAttendance(ctx, clubId),
    countEvaluationsToComplete(ctx, clubId),
    getMyPlatformAnnouncements(ctx),
    listMyRecentClubAnnouncements(ctx, 10),
    loadIdentitySwitcher(ctx.userId),
  ]);

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
            <UpcomingEvents events={upcoming} />
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <AnnouncementsPanel items={announcementItems} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { href: "/players", label: "Team Roster", Icon: Users },
          { href: "/schedule", label: "Schedule", Icon: CalendarDays },
          { href: "/attendance", label: "Attendance", Icon: ClipboardCheck },
        ].map(({ href, label, Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <CardTitle className="font-sport text-base">{label}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
