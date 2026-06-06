import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { listTeams } from "@/modules/clubs/service";
import { listTeamAttendance } from "@/modules/events/service";

/** Color the attendance ratio: green ≥80%, amber ≥50%, red below. */
function pctTone(pct: number | null): string {
  if (pct === null) return "bg-muted";
  if (pct >= 80) return "bg-primary";
  if (pct >= 50) return "bg-amber-500";
  return "bg-destructive";
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN", "COACH");
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const clubId = ctx.activeClubId;
  const sp = await searchParams;
  const teams = await listTeams(ctx, clubId);
  const teamOptions = teams.filter((t) => t.status !== "ARCHIVED").map((t) => ({ id: t.id, name: t.name }));
  const selectedTeamId =
    sp.team && teamOptions.some((t) => t.id === sp.team) ? sp.team : teamOptions[0]?.id;
  const rows = selectedTeamId ? await listTeamAttendance(ctx, selectedTeamId) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Attendance" description="Each player's attendance record across this team's events." />

      {teamOptions.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          You don&apos;t have any teams yet. Attendance appears once a team has players and recorded events.
        </p>
      ) : (
        <>
          <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="team">Team</Label>
              <Select id="team" name="team" defaultValue={selectedTeamId}>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="outline">
              View
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-2">
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                No players on this team yet.
              </p>
            ) : (
              rows.map((r) => (
                <Link
                  key={r.playerId}
                  href={`/attendance/${r.playerId}`}
                  className="flex items-center gap-4 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{r.name}</p>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${pctTone(r.pct)}`}
                        style={{ width: `${r.pct ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {r.pct === null ? "—" : `${r.pct}%`}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {r.total === 0 ? "no records" : `${r.attended}/${r.total} events`}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Mark attendance from an event on the{" "}
            <Link href="/schedule" className="underline">
              Schedule
            </Link>
            . Percentages count Present or Late as attended.
          </p>
        </>
      )}
    </div>
  );
}
