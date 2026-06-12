import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteConfirmDialog, StatusBadge } from "@/components/console";
import { requireRole } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { deleteCoachAction } from "@/modules/coaches/actions";
import { getCoachDeletionImpact, getCoachProfile } from "@/modules/coaches/service";
import { COACH_ROLE_LABELS } from "@/modules/clubs/schemas";

function roleLabel(roleType: string | null): string {
  if (!roleType) return "Coach";
  return COACH_ROLE_LABELS[roleType as keyof typeof COACH_ROLE_LABELS] ?? roleType;
}

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default async function CoachProfilePage({ params }: { params: Promise<{ coachId: string }> }) {
  const { coachId } = await params;
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN");
  if (!ctx.activeClubId) notFound();

  const profile = await getCoachProfile(ctx, coachId);
  if (!profile) notFound();

  const canDelete = can(ctx, "coach.delete", { clubId: ctx.activeClubId });
  const impact = canDelete ? await getCoachDeletionImpact(ctx, coachId) : [];

  return (
    <div className="mx-auto min-w-0 max-w-3xl">
      <Link href="/coaches" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← All coaches
      </Link>

      {/* Hero */}
      <div className="mt-3 flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-bold text-secondary-foreground">
            {(profile.name.trim()[0] ?? profile.email[0] ?? "?").toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl uppercase tracking-tight text-foreground wrap-break-word sm:text-3xl">
              {profile.name}
            </h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">{profile.email}</p>
            {profile.phone ? <p className="truncate text-sm text-muted-foreground">{profile.phone}</p> : null}
            {profile.lastLoginAt ? (
              <p className="text-xs text-muted-foreground">Last login {fmtDate(profile.lastLoginAt)}</p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0">
          <StatusBadge status={profile.status} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Current teams */}
        <Card>
          <CardHeader>
            <CardTitle className="font-sport text-base">Current teams</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.currentTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No current team assignments.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {profile.currentTeams.map((t) => (
                  <li key={t.teamId} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                    <Link href={`/teams/${t.teamId}`} className="min-w-0 flex-1 truncate font-medium text-foreground underline-offset-4 hover:underline">
                      {t.teamName}
                    </Link>
                    <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{roleLabel(t.roleType)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Past assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="font-sport text-base">Past assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.pastTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No past assignments.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {profile.pastTeams.map((t, i) => (
                  <li key={`${t.teamId ?? "deleted"}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {t.teamDeleted || !t.teamId ? (
                          <span className="break-words">{t.teamName}</span>
                        ) : (
                          <Link href={`/teams/${t.teamId}`} className="underline-offset-4 hover:underline">
                            {t.teamName}
                          </Link>
                        )}
                        {t.teamDeleted ? (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            team deleted
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                        {roleLabel(t.roleType)}
                        {t.endedAt ? ` · ended ${fmtDate(t.endedAt)}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {canDelete ? (
        <div className="mt-8 flex min-w-0 flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="min-w-0">
            <h2 className="font-sport text-base font-bold text-foreground">Danger zone</h2>
            <p className="mt-1 text-sm text-muted-foreground break-words">
              Deleting a coach is permanent and cannot be undone.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DeleteConfirmDialog
              triggerLabel="Delete coach"
              title="Delete this coach permanently?"
              confirmPhrase={profile.name}
              action={deleteCoachAction}
              fields={{ coachUserId: profile.userId }}
              description={
                <>
                  Permanently revokes <span className="font-semibold text-foreground">{profile.name}</span>&apos;s
                  access and removes them from this club&apos;s teams. Their login and any other roles are not
                  deleted, and teams are not deleted.
                  {impact.length > 0 ? (
                    <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                      {impact.map((i) => (
                        <li key={i.teamId} className="break-words">
                          <span className="font-semibold text-foreground">{i.teamName}</span>:{" "}
                          {i.willBeCoachless
                            ? "will be a coachless team until you reassign a coach"
                            : `still coached by ${i.remainingCoachName}`}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <span className="mt-2 block font-semibold text-foreground">This cannot be undone.</span>
                </>
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
