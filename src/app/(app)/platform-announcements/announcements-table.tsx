"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  ActionsMenu,
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  StatusBadge,
  type ActionItem,
  type Column,
} from "@/components/console";
import {
  archivePlatformAnnouncementAction,
  deletePlatformAnnouncementAction,
  duplicatePlatformAnnouncementAction,
  loadPlatformAnnouncementDetailAction,
  publishPlatformAnnouncementAction,
} from "@/modules/announcements/platform-actions";
import type { PlatformAnnouncementRow, PlatformTemplateRow } from "@/modules/announcements/platform-service";
import { ROLE_LABELS, isRole } from "@/lib/rbac";

import { ComposerDialog, type ComposerInitial } from "./composer-dialog";
import { SeverityBadge } from "./severity-badge";

function fmtDateTime(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function roleLabel(code: string): string {
  return isRole(code) ? ROLE_LABELS[code] : code;
}
function toLocalInput(d: Date | string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function AnnouncementsTable({
  rows,
  clubOptions,
  templates,
}: {
  rows: PlatformAnnouncementRow[];
  clubOptions: { id: string; name: string }[];
  templates: PlatformTemplateRow[];
}) {
  const router = useRouter();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<ComposerInitial | null>(null);
  const [, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error: string | null }>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  async function openEdit(id: string) {
    const d = await loadPlatformAnnouncementDetailAction(id);
    if (!d) return;
    setEditInitial({
      id: d.id,
      title: d.title,
      body: d.body,
      severity: d.severity,
      audienceScope: d.audienceScope,
      audienceRoles: d.audienceRoles,
      clubIds: d.clubs.map((c) => c.id),
      scheduledAt: toLocalInput(d.scheduledAt),
      expiresAt: toLocalInput(d.expiresAt),
      pinned: d.pinned,
    });
  }

  const columns: Column<PlatformAnnouncementRow>[] = [
    {
      key: "title",
      header: "Title",
      cell: (a) => (
        <span className="flex items-center gap-2">
          {a.pinned ? <span title="Pinned">📌</span> : null}
          <span className="font-medium text-foreground">{a.title}</span>
        </span>
      ),
    },
    { key: "severity", header: "Severity", cell: (a) => <SeverityBadge severity={a.severity} /> },
    {
      key: "audience",
      header: "Audience",
      cell: (a) => (
        <span className="text-muted-foreground">{a.audienceScope === "ALL_CLUBS" ? "All clubs" : `${a.clubCount} clubs`}</span>
      ),
    },
    {
      key: "roles",
      header: "Roles",
      cell: (a) => <span className="text-muted-foreground">{a.audienceRoles.map(roleLabel).join(", ")}</span>,
    },
    { key: "status", header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
    {
      key: "when",
      header: "Published / Scheduled",
      cell: (a) => <span suppressHydrationWarning className="whitespace-nowrap text-muted-foreground">{fmtDateTime(a.publishedAt ?? a.scheduledAt)}</span>,
    },
    { key: "reads", header: "Reads", className: "text-right tabular-nums", cell: (a) => a.reads },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      cell: (a) => {
        const items: ActionItem[] = [{ label: "View", onSelect: () => setDetailId(a.id) }];
        if (a.status === "DRAFT" || a.status === "SCHEDULED") {
          items.push({ label: "Edit", onSelect: () => void openEdit(a.id) });
          items.push({ label: "Publish now", onSelect: () => run(() => publishPlatformAnnouncementAction(a.id)) });
        }
        items.push({ label: "Duplicate", onSelect: () => run(() => duplicatePlatformAnnouncementAction(a.id)) });
        if (a.status !== "ARCHIVED") {
          items.push({ label: "Archive", onSelect: () => run(() => archivePlatformAnnouncementAction(a.id)) });
        }
        items.push({ label: "Delete", destructive: true, onSelect: () => run(() => deletePlatformAnnouncementAction(a.id)) });
        return <ActionsMenu items={items} />;
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => a.id}
        onRowClick={(a) => setDetailId(a.id)}
        emptyMessage="No announcements match your filters."
      />

      <DetailDrawer id={detailId} onOpenChange={(open) => !open && setDetailId(null)} />

      <ComposerDialog
        open={editInitial != null}
        onOpenChange={(open) => !open && setEditInitial(null)}
        clubOptions={clubOptions}
        templates={templates}
        initial={editInitial ?? undefined}
      />
    </>
  );
}

function DetailDrawer({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={id != null} onOpenChange={onOpenChange}>
      <DialogContent>{id ? <DetailContent key={id} id={id} /> : <DialogTitle className="sr-only">Announcement</DialogTitle>}</DialogContent>
    </Dialog>
  );
}

function DetailContent({ id }: { id: string }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof loadPlatformAnnouncementDetailAction>>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadPlatformAnnouncementDetailAction(id)
      .then((d) => {
        if (!active) return;
        if (!d) setError("Announcement not found.");
        else setDetail(d);
      })
      .catch(() => active && setError("Failed to load."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <>
        <DialogHeader><DialogTitle>Announcement</DialogTitle></DialogHeader>
        <DialogBody><p className="py-10 text-center text-sm text-destructive">{error}</p></DialogBody>
      </>
    );
  }
  if (loading || !detail) {
    return (
      <>
        <DialogHeader><DialogTitle>Loading…</DialogTitle></DialogHeader>
        <DialogBody><p className="py-10 text-center text-sm text-muted-foreground">Loading…</p></DialogBody>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{detail.title}</DialogTitle>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <SeverityBadge severity={detail.severity} />
          <StatusBadge status={detail.status} />
        </div>
      </DialogHeader>
      <DialogBody>
        <p className="whitespace-pre-wrap text-sm text-foreground">{detail.body}</p>

        <dl className="mt-5 grid grid-cols-2 gap-4">
          <Field label="Audience" value={detail.audienceScope === "ALL_CLUBS" ? "All clubs" : `${detail.clubs.length} clubs`} />
          <Field label="Roles" value={detail.audienceRoles.map(roleLabel).join(", ")} />
          <Field label="Published" value={fmtDateTime(detail.publishedAt)} />
          <Field label="Scheduled" value={fmtDateTime(detail.scheduledAt)} />
          <Field label="Expires" value={fmtDateTime(detail.expiresAt)} />
          <Field label="Pinned" value={detail.pinned ? "Yes" : "No"} />
        </dl>

        {detail.clubs.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Targeted: {detail.clubs.map((c) => c.name).join(", ")}</p>
        ) : null}

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Read stats</h3>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <Metric label="Reads" value={detail.stats.reads} />
          <Metric label="Dismissed" value={detail.stats.dismissed} />
          <Metric label="Clubs reached" value={detail.stats.clubsReached} />
        </div>
        {Object.keys(detail.stats.byRole).length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            By role: {Object.entries(detail.stats.byRole).map(([r, n]) => `${roleLabel(r)} ${n}`).join(" · ")}
          </p>
        ) : null}
      </DialogBody>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
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
