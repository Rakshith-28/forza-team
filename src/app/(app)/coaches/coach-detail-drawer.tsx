"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  StatusBadge,
} from "@/components/console";
import { COACH_ROLE_LABELS } from "@/modules/clubs/schemas";
import { loadCoachDetailAction } from "@/modules/master/actions";
import type { MasterCoachRow } from "@/modules/master/service";

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function roleLabel(roleType: string): string {
  return COACH_ROLE_LABELS[roleType as keyof typeof COACH_ROLE_LABELS] ?? roleType;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

/** Coach detail drawer — shows the selected coach's info + assignments, and
 * lazy-loads player/evaluation counts on open. */
export function CoachDetailDrawer({
  coach,
  onOpenChange,
}: {
  coach: MasterCoachRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={coach != null} onOpenChange={onOpenChange}>
      <DialogContent>
        {coach ? <CoachDetailContent key={coach.userId} coach={coach} /> : <DialogTitle className="sr-only">Coach</DialogTitle>}
      </DialogContent>
    </Dialog>
  );
}

function CoachDetailContent({ coach }: { coach: MasterCoachRow }) {
  const [counts, setCounts] = useState<{ playersOnTeams: number; evaluationsAuthored: number } | null>(null);

  useEffect(() => {
    let active = true;
    loadCoachDetailAction(coach.userId)
      .then((c) => active && setCounts(c))
      .catch(() => {
        /* counts are best-effort; leave as null */
      });
    return () => {
      active = false;
    };
  }, [coach.userId]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{coach.name}</DialogTitle>
        <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{coach.email}</span>
          <StatusBadge status={coach.status} />
        </p>
      </DialogHeader>
      <DialogBody>
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Phone" value={coach.phone} />
          <Field label="Last login" value={fmtDate(coach.lastLoginAt)} />
          <Field label="Clubs" value={coach.clubs.map((c) => c.name).join(", ")} />
          <Field label="Players coached" value={counts ? counts.playersOnTeams : "…"} />
          <Field label="Evaluations authored" value={counts ? counts.evaluationsAuthored : "…"} />
        </dl>

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team assignments</h3>
        {coach.teams.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No team assignments.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {coach.teams.map((t) => (
              <li key={t.teamId} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm font-medium text-foreground">{t.teamName}</span>
                <span className="text-xs text-muted-foreground">{roleLabel(t.roleType)}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogBody>
    </>
  );
}
