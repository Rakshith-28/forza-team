"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/console";
import { ROLE_LABELS, isRole } from "@/lib/rbac";
import { loadClubDetailAction } from "@/modules/master/actions";
import type { MasterClubDetail } from "@/modules/master/service";

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-secondary/40 p-3">
      <p className="font-sport text-xl font-extrabold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function roleLabel(code: string): string {
  return isRole(code) ? ROLE_LABELS[code] : code;
}

/**
 * Shared, read-first club detail drawer (Overview/Teams/Users/Settings/Audit).
 * Controlled by the parent via `clubId` (null = closed). The inner content is
 * keyed by clubId so switching clubs remounts with fresh state; it lazy-loads
 * detail on mount with loading/empty/error states. Row actions live in the
 * Clubs table.
 */
export function ClubDetailDrawer({
  clubId,
  onOpenChange,
}: {
  clubId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={clubId != null} onOpenChange={onOpenChange}>
      <DialogContent>{clubId ? <ClubDetailContent key={clubId} clubId={clubId} /> : <DialogTitle className="sr-only">Club</DialogTitle>}</DialogContent>
    </Dialog>
  );
}

function ClubDetailContent({ clubId }: { clubId: string }) {
  const [detail, setDetail] = useState<MasterClubDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadClubDetailAction(clubId)
      .then((d) => {
        if (!active) return;
        if (!d) setError("Club not found.");
        else setDetail(d);
      })
      .catch(() => active && setError("Failed to load club."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [clubId]);

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          {detail?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote logo, matches app convention
            <img src={detail.logoUrl} alt="" className="size-10 rounded-full border object-cover" />
          ) : null}
          <div>
            <DialogTitle>{detail?.name ?? (loading ? "Loading…" : "Club")}</DialogTitle>
            {detail ? (
              <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                <span>{detail.shortCode}</span>
                <StatusBadge status={detail.status} />
              </p>
            ) : null}
          </div>
        </div>
      </DialogHeader>

      <DialogBody>
        {error ? (
          <p className="py-10 text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : loading || !detail ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading club…</p>
        ) : (
          <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="teams">Teams ({detail.teams.length})</TabsTrigger>
                <TabsTrigger value="users">Users ({detail.users.length})</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="audit">Audit</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="Teams" value={detail.metrics.teams} />
                  <Metric label="Players" value={detail.metrics.players} />
                  <Metric label="Users" value={detail.metrics.users} />
                  <Metric label="Coaches" value={detail.metrics.coaches} />
                  <Metric label="Parents" value={detail.metrics.parents} />
                  <Metric label="Open Invoices" value={detail.metrics.openInvoices} />
                  <Metric label="Waivers" value={detail.metrics.waiverAcceptances} />
                  <Metric label="Eval Cycles" value={detail.metrics.activeEvaluationCycles} />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4">
                  <Field label="Club colors" value={
                    detail.primaryColor || detail.secondaryColor ? (
                      <span className="inline-flex items-center gap-2">
                        {detail.primaryColor ? <span className="inline-block size-4 rounded-full border" style={{ backgroundColor: detail.primaryColor }} /> : null}
                        {detail.secondaryColor ? <span className="inline-block size-4 rounded-full border" style={{ backgroundColor: detail.secondaryColor }} /> : null}
                        <span className="text-muted-foreground">{[detail.primaryColor, detail.secondaryColor].filter(Boolean).join(" / ")}</span>
                      </span>
                    ) : null
                  } />
                  <Field label="Phone" value={detail.phone} />
                  <Field label="Website" value={detail.website} />
                  <Field label="Timezone" value={detail.timezone} />
                  <Field
                    label="Address"
                    value={[detail.addressLine1, detail.addressLine2, detail.city, detail.state, detail.postalCode, detail.country].filter(Boolean).join(", ")}
                  />
                  <Field label="Created" value={fmtDate(detail.createdAt)} />
                  <Field label="Updated" value={fmtDate(detail.updatedAt)} />
                </dl>
              </TabsContent>

              <TabsContent value="teams">
                {detail.teams.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No teams yet.</p>
                ) : (
                  <ul className="divide-y">
                    {detail.teams.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t.teamCode}
                            {t.ageGroup ? ` · ${t.ageGroup}` : ""}
                            {t.seasonName ? ` · ${t.seasonName}` : ""}
                            {t.headCoachName ? ` · Coach: ${t.headCoachName}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-muted-foreground">{t.playerCount} players</span>
                          <StatusBadge status={t.status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="users">
                {detail.users.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No users yet.</p>
                ) : (
                  <ul className="divide-y">
                    {detail.users.map((u) => (
                      <li key={u.userId} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-muted-foreground">{u.roleCodes.map(roleLabel).join(", ")}</span>
                          <StatusBadge status={u.status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="settings">
                {detail.settings ? (
                  <dl className="grid grid-cols-2 gap-4">
                    <Field label="Default currency" value={detail.settings.defaultCurrency} />
                    <Field label="AI features" value={detail.settings.enableAiFeatures ? "On" : "Off"} />
                    <Field label="SMS notifications" value={detail.settings.enableSmsNotifications ? "On" : "Off"} />
                    <Field label="Registration" value={detail.settings.registrationEnabled ? "Enabled" : "Disabled"} />
                    <Field label="Billing" value={detail.settings.billingEnabled ? "Enabled" : "Disabled"} />
                    <Field label="Attendance tracking" value={detail.settings.attendanceTrackingEnabled ? "On" : "Off"} />
                    <Field label="Player photos to parents" value={detail.settings.showPlayerPhotosToParents ? "On" : "Off"} />
                    <Field label="Parent evaluation view" value={detail.settings.allowParentChildEvaluationView ? "On" : "Off"} />
                  </dl>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">No settings record.</p>
                )}
              </TabsContent>

              <TabsContent value="audit">
                {detail.recentAudit.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No recent activity.</p>
                ) : (
                  <ul className="divide-y">
                    {detail.recentAudit.map((a) => (
                      <li key={a.id} className="py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{a.action}</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(a.createdAt)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {a.resourceType}
                          {a.actorName ? ` · by ${a.actorName}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogBody>
    </>
  );
}
