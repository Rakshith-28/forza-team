import Link from "next/link";

import { requireRole } from "@/lib/auth-guards";
import { listLinkedChildren } from "@/modules/roster/service";
import { getChildAttendance, listParentSchedule } from "@/modules/events/service";
import { listAnnouncements, listChatTeams } from "@/modules/comms/service";
import { formatEventTime } from "@/modules/events/format";
import {
  AttendanceRing,
  CollectibleCard,
  StatTile,
  StoriesStrip,
  XpBar,
} from "@/components/app/parent/widgets";

import { RsvpControl } from "../../schedule/rsvp-control";

/**
 * Player/parent HOME — a bento-grid dashboard inside the themed mobile shell.
 * Real data: next match + RSVP, attendance ring, collectible card, XP/level,
 * announcements as a stories strip, chat peek. Vibrant/Classic render this same
 * markup differently purely via tokens.
 */
export default async function ParentHome() {
  const ctx = await requireRole("PARENT");

  const [children, schedule, chatTeams] = await Promise.all([
    listLinkedChildren(ctx),
    listParentSchedule(ctx, { upcomingOnly: true, limit: 5 }),
    listChatTeams(ctx),
  ]);

  if (children.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-display text-2xl uppercase text-foreground">Welcome</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          No children are linked to your account yet. Your club admin links your children to your profile.
        </p>
      </div>
    );
  }

  const primary = children[0];
  const upcoming = schedule.filter((s) => s.event.status !== "CANCELLED");
  const nextMatch = upcoming[0] ?? null;

  // Attendance ring + XP (derived, deterministic) for the primary child.
  const attendance = await getChildAttendance(ctx, primary.id);
  const present = attendance.filter((a) => a.attendanceStatus === "PRESENT" || a.attendanceStatus === "LATE").length;
  const rsvpCount = schedule.reduce(
    (n, s) => n + s.children.filter((c) => c.playerId === primary.id && c.rsvpStatus).length,
    0,
  );
  const xp = present * 10 + rsvpCount * 5;
  const level = Math.floor(xp / 100) + 1;
  const progress = xp % 100;

  // Stories = recent published announcements.
  const clubId = ctx.activeClubId;
  const announcements = clubId ? await listAnnouncements(ctx, clubId) : [];
  const stories = announcements
    .filter((a) => a.status === "PUBLISHED")
    .slice(0, 6)
    .map((a) => ({ id: a.id, title: a.title }));

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="font-display text-2xl uppercase leading-none text-foreground">{primary.displayName}</h1>
      </div>

      {children.length > 1 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/my-kids/${c.id}`}
              className="app-pill shrink-0 bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
            >
              {c.displayName}
            </Link>
          ))}
        </div>
      ) : null}

      <StoriesStrip items={stories} />

      <CollectibleCard
        name={primary.displayName}
        jerseyNumber={primary.jerseyNumber}
        position={primary.primaryPosition}
        teamName={primary.teams[0]?.name ?? null}
        photoUrl={primary.photoUrl}
        href={`/my-kids/${primary.id}`}
      />

      {/* Next match + RSVP */}
      <div className="app-card p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Next up</p>
        {nextMatch ? (
          <>
            <p className="mt-1 font-sport text-lg font-bold text-foreground">{nextMatch.event.title}</p>
            <p className="text-sm text-muted-foreground">
              {formatEventTime(nextMatch.event.startAt, nextMatch.event.timezone)}
              {nextMatch.event.teamName ? ` · ${nextMatch.event.teamName}` : ""}
            </p>
            <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
              {nextMatch.children.map((c) => (
                <RsvpControl
                  key={c.playerId}
                  eventId={nextMatch.event.id}
                  playerId={c.playerId}
                  playerName={c.name}
                  current={c.rsvpStatus}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Nothing scheduled. Enjoy the break! ⚽</p>
        )}
      </div>

      {/* Bento row: attendance + XP + chat peek */}
      <div className="grid grid-cols-2 gap-4">
        <div className="app-card flex items-center justify-between p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Attendance</p>
            <p className="text-[11px] text-muted-foreground">{present} of {attendance.length}</p>
          </div>
          <AttendanceRing present={present} total={attendance.length} />
        </div>
        <StatTile label="Upcoming events" value={String(upcoming.length)} accent="var(--pop-5)" />
      </div>

      <XpBar level={level} progress={progress} />

      <Link href="/chat" className="app-card flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Team chat</p>
          <p className="font-sport text-base font-bold text-foreground">
            {chatTeams[0]?.name ?? "No team chat yet"}
          </p>
        </div>
        <span className="text-2xl">💬</span>
      </Link>
    </div>
  );
}
