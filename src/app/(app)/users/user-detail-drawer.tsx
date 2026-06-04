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
import { ROLE_LABELS, isRole } from "@/lib/rbac";
import { loadUserDetailAction } from "@/modules/master/actions";
import type { MasterUserDetail } from "@/modules/master/service";

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function roleLabel(code: string): string {
  return isRole(code) ? ROLE_LABELS[code] : code;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

export function UserDetailDrawer({
  userId,
  onOpenChange,
}: {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={userId != null} onOpenChange={onOpenChange}>
      <DialogContent>
        {userId ? <UserDetailContent key={userId} userId={userId} /> : <DialogTitle className="sr-only">User</DialogTitle>}
      </DialogContent>
    </Dialog>
  );
}

function UserDetailContent({ userId }: { userId: string }) {
  const [detail, setDetail] = useState<MasterUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadUserDetailAction(userId)
      .then((d) => {
        if (!active) return;
        if (!d) setError("User not found.");
        else setDetail(d);
      })
      .catch(() => active && setError("Failed to load user."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId]);

  if (error) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>User</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="py-10 text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        </DialogBody>
      </>
    );
  }

  if (loading || !detail) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Loading…</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="py-10 text-center text-sm text-muted-foreground">Loading user…</p>
        </DialogBody>
      </>
    );
  }

  const np = detail.notificationPreference;
  const prefs = np
    ? [
        ["Email", np.emailEnabled],
        ["Push", np.pushEnabled],
        ["SMS", np.smsEnabled],
        ["Chat", np.chatNotificationsEnabled],
        ["Announcements", np.announcementNotificationsEnabled],
        ["Billing", np.billingNotificationsEnabled],
        ["Schedule", np.scheduleNotificationsEnabled],
      ]
    : [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{detail.name}</DialogTitle>
        <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{detail.email}</span>
          <StatusBadge status={detail.status} />
        </p>
      </DialogHeader>
      <DialogBody>
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Phone" value={detail.phone} />
          <Field label="Last login" value={fmtDate(detail.lastLoginAt)} />
          <Field label="Member since" value={fmtDate(detail.createdAt)} />
          <Field label="Clubs" value={detail.clubNames.join(", ")} />
        </dl>

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role assignments</h3>
        {detail.assignments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No active role assignments.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {detail.assignments.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm font-medium text-foreground">{roleLabel(a.roleCode)}</span>
                <span className="text-xs text-muted-foreground">
                  {[a.clubName, a.teamName].filter(Boolean).join(" · ") || "System"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {np ? (
          <>
            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notification preferences
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {prefs.map(([label, on]) => (
                <span
                  key={label as string}
                  className={`rounded-full px-2.5 py-0.5 text-xs ${on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                >
                  {label}: {on ? "On" : "Off"}
                </span>
              ))}
            </div>
          </>
        ) : null}

        {detail.pendingInvitations.length > 0 ? (
          <>
            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pending invitations
            </h3>
            <ul className="mt-2 divide-y">
              {detail.pendingInvitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm text-foreground">
                    {roleLabel(inv.roleCode)}
                    {inv.clubName ? ` · ${inv.clubName}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtDate(inv.createdAt)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </DialogBody>
    </>
  );
}
