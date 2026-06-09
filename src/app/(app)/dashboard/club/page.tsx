import Link from "next/link";
import { CalendarClock, CalendarRange, Shield, UserCog, Users, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/console";
import { PlatformAnnouncementsPanel } from "@/components/app/platform-announcements-panel";
import { ScrollPanel } from "@/components/app/scroll-panel";
import { requireRole } from "@/lib/auth-guards";
import { getMyPlatformAnnouncements, getMyUnreadPlatformAnnouncementCount } from "@/modules/announcements/platform-service";
import { getClub, getClubSummary, listSeasons, listTeams } from "@/modules/clubs/service";
import { listCoaches } from "@/modules/coaches/service";
import { countEventsNeedingAttendance, listUpcomingEvents } from "@/modules/events/service";
import { EVENT_TYPE_LABELS, type EventType } from "@/modules/events/schemas";
import { formatEventTime } from "@/modules/events/format";

import { ClubNameForm } from "../../clubs/club-forms";

/** Section title with the coach-portal accent treatment (bar + icon). */
function AccentTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-5 w-1 rounded-full bg-primary" aria-hidden />
      <Icon className="size-4 text-primary" aria-hidden />
      <span>{children}</span>
    </span>
  );
}

/** Small "show more" pill linking to a full section. */
function ShowMore({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
    >
      Show more →
    </Link>
  );
}

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
  const [club, summary, upcoming, needsAttendance, announcements, unread, coaches, seasons, teams] =
    await Promise.all([
      getClub(ctx, clubId),
      getClubSummary(ctx, clubId),
      listUpcomingEvents(ctx, clubId, 8),
      countEventsNeedingAttendance(ctx, clubId),
      getMyPlatformAnnouncements(ctx),
      getMyUnreadPlatformAnnouncementCount(ctx),
      listCoaches(ctx, clubId),
      listSeasons(ctx, clubId),
      listTeams(ctx, clubId),
    ]);

  const stats: { label: string; value: number; href: string; icon: LucideIcon }[] = [
    { label: "Teams", value: summary.teamCount, href: "/teams", icon: Shield },
    { label: "Players", value: summary.playerCount, href: "/players", icon: Users },
    { label: "Active seasons", value: summary.activeSeasonCount, href: "/seasons", icon: CalendarRange },
    { label: "Coaches assigned", value: summary.coachCount, href: "/coaches", icon: UserCog },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      {/* Hero header band */}
      <div className="rounded-2xl border bg-linear-to-br from-primary/10 via-card to-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-tight text-foreground wrap-break-word sm:text-3xl md:text-4xl">
              {club?.name ?? "Club"}
            </h1>
            <p className="mt-1 font-medium text-foreground/80">Your club at a glance.</p>
          </div>
          {club ? (
            <ClubNameForm key={club.updatedAt.toISOString()} clubId={club.id} name={club.name} />
          ) : null}
        </div>
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

      {/* KPI cards — count on the left, large accent icon filling the right. */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="h-full transition-all hover:border-primary hover:shadow-sm">
                <CardContent className="flex items-center justify-between gap-3 pt-6">
                  <div>
                    <p className="font-sport text-3xl font-extrabold text-foreground">{s.value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
                  </div>
                  <Icon className="size-10 shrink-0 text-primary/25" aria-hidden />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        <PlatformAnnouncementsPanel items={announcements} unread={unread} accent />
      </div>

      {/* Coaches — hollow scroll container, ~3 visible. */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-sport text-base font-bold tracking-tight text-foreground">
            <AccentTitle icon={UserCog}>Coaches</AccentTitle>
          </h2>
          <ShowMore href="/coaches" />
        </div>
        {coaches.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            No coaches yet. <Link href="/coaches" className="underline">Invite one</Link>.
          </p>
        ) : (
          <ScrollPanel maxHeightClass="max-h-54">
            {coaches.map((c) => (
              <div
                key={`${c.kind}-${c.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-all hover:border-primary hover:shadow-sm"
              >
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                >
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.teams.length > 0 ? c.teams.map((t) => t.teamName).join(", ") : "No team assigned"}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </ScrollPanel>
        )}
      </section>

      {/* Seasons + Teams — two cards listing a few items with a show-more link. */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="h-full transition-all hover:border-primary hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="font-sport text-base">
              <AccentTitle icon={CalendarRange}>Seasons</AccentTitle>
            </CardTitle>
            <ShowMore href="/seasons" />
          </CardHeader>
          <CardContent>
            {seasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No seasons yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {seasons.slice(0, 4).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium text-foreground">{s.name}</span>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="h-full transition-all hover:border-primary hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="font-sport text-base">
              <AccentTitle icon={Shield}>Teams</AccentTitle>
            </CardTitle>
            <ShowMore href="/teams" />
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teams yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {teams.slice(0, 4).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium text-foreground">
                      {t.name}
                      {t.season ? <span className="ml-1.5 text-xs text-muted-foreground">· {t.season.name}</span> : null}
                    </span>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming events — hollow scroll container, ~3 visible. */}
      <section className="mt-6">
        <h2 className="mb-3 font-sport text-base font-bold tracking-tight text-foreground">
          <AccentTitle icon={CalendarClock}>Upcoming events</AccentTitle>
        </h2>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            No upcoming events. <Link href="/schedule" className="underline">Open the schedule</Link>.
          </p>
        ) : (
          <ScrollPanel maxHeightClass="max-h-56">
            {upcoming.map((e) => (
              <Link
                key={e.id}
                href={`/schedule/${e.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition-all hover:border-primary hover:shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{e.title}</p>
                  <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                    {EVENT_TYPE_LABELS[e.eventType as EventType] ?? e.eventType}
                    {e.team ? ` · ${e.team.name}` : " · Club-wide"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatEventTime(e.startAt, e.timezone)}</span>
              </Link>
            ))}
          </ScrollPanel>
        )}
      </section>
    </div>
  );
}
