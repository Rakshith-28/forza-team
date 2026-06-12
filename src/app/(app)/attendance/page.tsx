import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { listTeams } from "@/modules/clubs/service";
import { getTeamAttendanceTrend, listTeamAttendance } from "@/modules/events/service";
import { listTeamRemarks } from "@/modules/remarks/service";
import { formatEventDateChip, formatEventTime } from "@/modules/events/format";

import { AttendanceView, type PlayerRemarks, type TrendPoint } from "./attendance-view";

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

  const [rows, teamRemarks, trend] = selectedTeamId
    ? await Promise.all([
        listTeamAttendance(ctx, selectedTeamId),
        listTeamRemarks(ctx, selectedTeamId),
        getTeamAttendanceTrend(ctx, selectedTeamId),
      ])
    : [[], [], []];

  // Serialize the trend for the client line chart: a compact x-axis label + a
  // full label (with time) for the hover tooltip.
  const trendPoints: TrendPoint[] = trend.map((t) => {
    const chip = formatEventDateChip(t.date, t.timezone);
    return {
      label: `${chip.month} ${chip.day}`,
      fullLabel: formatEventTime(t.date, t.timezone),
      pct: t.pct,
      attended: t.attended,
      total: t.total,
    };
  });

  // Serialize remark dates for the client view.
  const remarks: PlayerRemarks[] = teamRemarks.map((p) => ({
    playerId: p.playerId,
    name: p.name,
    remarks: p.remarks.map((r) => ({
      id: r.id,
      body: r.body,
      playerVisible: r.playerVisible,
      createdAt: r.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Attendance"
        description="Team attendance at a glance, plus private remarks you can share with players."
      />

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

          <AttendanceView rows={rows} remarks={remarks} trend={trendPoints} />

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
