import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoUpload } from "@/components/app/photo-upload";
import { requireRole } from "@/lib/auth-guards";
import { getOwnChild, listLinkedChildren } from "@/modules/roster/service";
import { getChildAttendance } from "@/modules/events/service";
import { ATTENDANCE_LABELS, type AttendanceStatus } from "@/modules/events/schemas";
import { formatEventTime } from "@/modules/events/format";
import { parentEvaluationViewEnabled } from "@/modules/evaluations/service";

import { StatusBadge } from "../../seasons/season-forms";
import { ChildEditForm } from "./child-edit-client";

export default async function ChildProfilePage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const ctx = await requireRole("PARENT");

  const [child, siblings, attendance, evalEnabled] = await Promise.all([
    getOwnChild(ctx, playerId),
    listLinkedChildren(ctx),
    getChildAttendance(ctx, playerId),
    ctx.activeClubId ? parentEvaluationViewEnabled(ctx.activeClubId) : Promise.resolve(false),
  ]);
  if (!child) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← My Kids
      </Link>

      {siblings.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {siblings.map((s) => (
            <Link
              key={s.id}
              href={`/my-kids/${s.id}`}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                s.id === child.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-sidebar-accent"
              }`}
            >
              {s.displayName}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">{child.displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {child.firstName} {child.lastName}
            {child.jerseyNumber ? ` · #${child.jerseyNumber}` : ""}
            {child.primaryPosition ? ` · ${child.primaryPosition}` : ""}
            {child.secondaryPosition ? ` / ${child.secondaryPosition}` : ""}
            {child.dateOfBirth ? ` · DOB ${child.dateOfBirth}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={child.status} />
          {evalEnabled ? (
            <Link
              href={`/my-kids/${child.id}/evaluations`}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
            >
              Evaluations
            </Link>
          ) : null}
          <ChildEditForm
            child={{
              id: child.id,
              preferredName: child.preferredName,
              photoUrl: child.photoUrl,
              emergencyContactName: child.emergencyContactName,
              emergencyContactPhone: child.emergencyContactPhone,
              medicalNotes: child.medicalNotes,
              allergyNotes: child.allergyNotes,
            }}
          />
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Photo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {child.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={child.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-secondary-foreground">
              {child.displayName.slice(0, 1)}
            </span>
          )}
          <PhotoUpload playerId={child.id} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Care details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Emergency contact" value={child.emergencyContactName} />
          <Detail label="Emergency phone" value={child.emergencyContactPhone} />
          <Detail label="Medical notes" value={child.medicalNotes} />
          <Detail label="Allergy notes" value={child.allergyNotes} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Teams</CardTitle>
        </CardHeader>
        <CardContent>
          {child.teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not on any team yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {child.teams.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
                  <span className="font-medium text-foreground">{t.name}</span>
                  <Link
                    href={`/my-kids/${child.id}/roster/${t.id}`}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    View team roster
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {attendance.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{a.event.title}</p>
                    <p className="text-xs text-muted-foreground">{formatEventTime(a.event.startAt, a.event.timezone)}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                    {ATTENDANCE_LABELS[a.attendanceStatus as AttendanceStatus] ?? a.attendanceStatus}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground">{value || "—"}</p>
    </div>
  );
}
