import Link from "next/link";

/**
 * Coach dashboard quick tiles — Team Roster, Schedule, Attendance. Each tile
 * leads with a small visual (overlapping player avatars, upcoming-date chips, an
 * attendance sparkline) instead of a plain icon, with a stat line and a deep
 * link. Pure presentation; data is resolved by the dashboard page.
 */

export interface RosterAvatar {
  id: string;
  displayName: string;
  photoUrl: string | null;
}

export interface ScheduleChip {
  id: string;
  month: string;
  day: string;
}

export interface CoachQuickTilesProps {
  roster: { href: string; count: number; avatars: RosterAvatar[] };
  schedule: { href: string; matchCount: number; chips: ScheduleChip[] };
  attendance: { href: string; avgPct: number | null; lastPct: number | null; series: number[] };
}

export function CoachQuickTiles({ roster, schedule, attendance }: CoachQuickTilesProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Tile
        href={roster.href}
        title="Team Roster"
        action="View full list"
        stat={`${roster.count} ${roster.count === 1 ? "Player" : "Players"}`}
        visual={<RosterAvatars avatars={roster.avatars} total={roster.count} />}
      />

      <Tile
        href={schedule.href}
        title="Schedule"
        action="Full season view"
        stat={
          schedule.matchCount > 0
            ? `Next ${schedule.matchCount} ${schedule.matchCount === 1 ? "event" : "events"}`
            : "Nothing scheduled"
        }
        visual={<ScheduleChips chips={schedule.chips} />}
      />

      <Tile
        href={attendance.href}
        title="Attendance"
        action="Track now"
        stat={
          attendance.avgPct === null ? (
            "No data yet"
          ) : (
            <>
              Avg {attendance.avgPct}%
              {attendance.lastPct !== null ? (
                <span className="text-muted-foreground"> · Last {attendance.lastPct}%</span>
              ) : null}
            </>
          )
        }
        visual={<Sparkline series={attendance.series} />}
      />
    </div>
  );
}

function Tile({
  href,
  title,
  action,
  stat,
  visual,
}: {
  href: string;
  title: string;
  action: string;
  stat: React.ReactNode;
  visual: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-row items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-all hover:border-primary hover:shadow-sm"
    >
      {/* Left: text info */}
      <div className="flex min-w-0 flex-col">
        <p className="font-sport text-base font-bold text-foreground">{title}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{stat}</p>
        <span className="mt-2 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
          {action} →
        </span>
      </div>
      {/* Right: visual */}
      <div className="flex shrink-0 items-center justify-center">{visual}</div>
    </Link>
  );
}

function RosterAvatars({ avatars, total }: { avatars: RosterAvatar[]; total: number }) {
  if (avatars.length === 0) {
    return <p className="text-right text-xs text-muted-foreground">No players yet</p>;
  }
  // Cap to 4 circles so the stack stays compact beside the text.
  const MAX = 4;
  const showOverflow = total > MAX;
  const shown = avatars.slice(0, showOverflow ? MAX - 1 : MAX);
  const overflow = total - shown.length;
  return (
    <div className="flex -space-x-2.5">
      {shown.map((a) =>
        a.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={a.id}
            src={a.photoUrl}
            alt=""
            className="size-9 rounded-full object-cover ring-2 ring-card"
          />
        ) : (
          <span
            key={a.id}
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-2 ring-card"
          >
            {a.displayName.slice(0, 1).toUpperCase()}
          </span>
        ),
      )}
      {showOverflow && overflow > 0 ? (
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary ring-2 ring-card">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function ScheduleChips({ chips }: { chips: ScheduleChip[] }) {
  if (chips.length === 0) {
    return <p className="text-right text-xs text-muted-foreground">Nothing upcoming</p>;
  }
  return (
    <div className="flex gap-1.5">
      {chips.map((c) => (
        <div
          key={c.id}
          className="flex w-9 flex-col items-center overflow-hidden rounded-md border bg-background text-center"
        >
          <span className="w-full bg-primary/10 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-primary">
            {c.month}
          </span>
          <span className="py-1 text-sm font-bold leading-none tabular-nums text-foreground">{c.day}</span>
        </div>
      ))}
    </div>
  );
}

/** Minimal dependency-free attendance sparkline (line + soft area fill). */
function Sparkline({ series }: { series: number[] }) {
  if (series.length === 0) {
    return <p className="text-right text-xs text-muted-foreground">No attendance yet</p>;
  }
  const w = 100;
  const h = 40;
  const pad = 4;
  const max = 100;
  const n = series.length;
  const x = (i: number) => (n === 1 ? w / 2 : pad + (i / (n - 1)) * (w - pad * 2));
  const y = (v: number) => pad + (1 - v / max) * (h - pad * 2);
  const points = series.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `M ${pad},${h - pad} L ${series.map((v, i) => `${x(i)},${y(v)}`).join(" L ")} L ${x(n - 1)},${h - pad} Z`;
  const last = series[n - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-primary" role="img" aria-label="Recent attendance trend">
      <path d={area} className="fill-primary/10" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(n - 1)} cy={y(last)} r={3} className="fill-primary" />
    </svg>
  );
}
