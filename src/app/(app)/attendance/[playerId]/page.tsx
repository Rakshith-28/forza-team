import Link from "next/link";

import { StatusBadge } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { getPlayerAttendanceForStaff } from "@/modules/events/service";
import { ATTENDANCE_LABELS, EVENT_TYPE_LABELS, type AttendanceStatus, type EventType } from "@/modules/events/schemas";
import { formatEventTime } from "@/modules/events/format";

const STATUS_TONE: Record<string, string> = {
  PRESENT: "bg-primary/10 text-primary",
  LATE: "bg-amber-100 text-amber-700",
  EXCUSED_ABSENT: "bg-secondary text-secondary-foreground",
  UNEXCUSED_ABSENT: "bg-destructive/10 text-destructive",
  INJURED: "bg-violet-100 text-violet-700",
  PARTIAL: "bg-sky-100 text-sky-700",
};

const ATTENDED = new Set(["PRESENT", "LATE"]);

export default async function PlayerAttendancePage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN", "COACH");
  const { playerId } = await params;
  const { player, records } = await getPlayerAttendanceForStaff(ctx, playerId);

  const name = player.preferredName ?? `${player.firstName} ${player.lastName}`;
  const total = records.length;
  const attended = records.filter((r) => ATTENDED.has(r.attendanceStatus)).length;
  const pct = total > 0 ? Math.round((attended / total) * 100) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/attendance" className="text-sm text-muted-foreground hover:text-foreground">
        ← Attendance
      </Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">{name}</h1>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-foreground">{pct === null ? "—" : `${pct}%`}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {total === 0 ? "no records yet" : `${attended}/${total} events attended`}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {records.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No attendance recorded for this player yet.
          </p>
        ) : (
          records.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{r.event.title}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {EVENT_TYPE_LABELS[r.event.eventType as EventType] ?? r.event.eventType}
                  {r.event.team ? ` · ${r.event.team.name}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatEventTime(r.event.startAt, r.event.timezone)}</p>
              </div>
              <StatusBadge
                status={ATTENDANCE_LABELS[r.attendanceStatus as AttendanceStatus] ?? r.attendanceStatus}
                className={STATUS_TONE[r.attendanceStatus] ?? ""}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
