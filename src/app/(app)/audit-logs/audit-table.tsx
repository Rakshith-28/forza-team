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
import type { MasterAuditRow } from "@/modules/master/service";

function fmtDateTime(d: Date | string): string {
  return new Date(d).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetadataView({ metadata }: { metadata: unknown }) {
  if (metadata == null) return <p className="text-sm text-muted-foreground">No details.</p>;
  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    const entries = Object.entries(metadata as Record<string, unknown>);
    if (entries.length === 0) return <p className="text-sm text-muted-foreground">No details.</p>;
    return (
      <dl className="grid grid-cols-2 gap-3">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 break-words text-sm text-foreground">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return <pre className="overflow-x-auto rounded-md bg-secondary/60 p-3 text-xs">{JSON.stringify(metadata, null, 2)}</pre>;
}

export function AuditTable({ rows }: { rows: MasterAuditRow[] }) {
  const [selected, setSelected] = useState<MasterAuditRow | null>(null);

  const columns: Column<MasterAuditRow>[] = [
    { key: "ts", header: "Timestamp", cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{fmtDateTime(r.createdAt)}</span> },
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
