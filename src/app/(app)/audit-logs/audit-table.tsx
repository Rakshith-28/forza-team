"use client";

import { useState } from "react";

import {
  DataTable,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  type Column,
} from "@/components/console";
/** Structural row shared by the Master (system-wide) and Club (single-club) audit views. */
export interface AuditRow {
  id: string;
  createdAt: Date;
  actorName: string | null;
  clubName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  ipAddress: string | null;
}

function fmtDateTime(d: Date | string): string {
  return new Date(d).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Render one metadata value: arrays join, nested objects expand one level (the delete `snapshot`). */
function ValueView({ value }: { value: unknown }) {
  if (value == null || value === "") return <span className="text-muted-foreground">—</span>;
  if (Array.isArray(value)) {
    return value.length ? <>{value.map((v) => String(v)).join(", ")}</> : <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "object") {
    return (
      <dl className="mt-1 grid grid-cols-2 gap-2 rounded-md bg-secondary/40 p-2">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 break-words text-sm text-foreground">
              <ValueView value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <>{String(value)}</>;
}

function MetadataView({ metadata }: { metadata: unknown }) {
  if (metadata == null) return <p className="text-sm text-muted-foreground">No details.</p>;
  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    const entries = Object.entries(metadata as Record<string, unknown>);
    if (entries.length === 0) return <p className="text-sm text-muted-foreground">No details.</p>;
    return (
      <dl className="grid grid-cols-1 gap-3">
        {entries.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 break-words text-sm text-foreground">
              <ValueView value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <pre className="overflow-x-auto rounded-md bg-secondary/60 p-3 text-xs">{JSON.stringify(metadata, null, 2)}</pre>;
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const columns: Column<AuditRow>[] = [
    { key: "ts", header: "Timestamp", cell: (r) => <span suppressHydrationWarning className="whitespace-nowrap text-muted-foreground">{fmtDateTime(r.createdAt)}</span> },
    { key: "actor", header: "Actor", cell: (r) => r.actorName ?? <span className="text-muted-foreground">System</span> },
    { key: "club", header: "Club", cell: (r) => r.clubName ?? <span className="text-muted-foreground">—</span> },
    { key: "action", header: "Action", cell: (r) => <span className="font-medium text-foreground">{r.action}</span> },
    { key: "resourceType", header: "Resource", cell: (r) => <span className="text-muted-foreground">{r.resourceType}</span> },
    {
      key: "resourceId",
      header: "Resource ID",
      cell: (r) => (r.resourceId ? <span className="font-mono text-xs text-muted-foreground">{r.resourceId.slice(0, 8)}…</span> : <span className="text-muted-foreground">—</span>),
    },
    { key: "details", header: "", className: "w-16 text-right", cell: () => <span className="text-xs text-primary">Details</span> },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        onRowClick={(r) => setSelected(r)}
        emptyMessage="No audit entries match your filters."
      />

      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.action}</DialogTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">{fmtDateTime(selected.createdAt)}</p>
              </DialogHeader>
              <DialogBody>
                <dl className="grid grid-cols-2 gap-3">
                  <Field label="Actor" value={selected.actorName ?? "System"} />
                  <Field label="Club" value={selected.clubName ?? "—"} />
                  <Field label="Resource type" value={selected.resourceType} />
                  <Field label="Resource ID" value={selected.resourceId ?? "—"} />
                  <Field label="IP address" value={selected.ipAddress ?? "—"} />
                </dl>
                <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Metadata</h3>
                <div className="mt-2">
                  <MetadataView metadata={selected.metadata} />
                </div>
              </DialogBody>
            </>
          ) : (
            <DialogTitle className="sr-only">Audit entry</DialogTitle>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}
