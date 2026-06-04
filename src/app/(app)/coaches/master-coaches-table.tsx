"use client";

import { useState } from "react";

import { ActionsMenu, DataTable, PersonCell, StatusBadge, type Column } from "@/components/console";
import { COACH_ROLE_LABELS } from "@/modules/clubs/schemas";
import type { MasterCoachRow } from "@/modules/master/service";

import { CoachDetailDrawer } from "./coach-detail-drawer";

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function roleLabel(roleType: string): string {
  return COACH_ROLE_LABELS[roleType as keyof typeof COACH_ROLE_LABELS] ?? roleType;
}

export function MasterCoachesTable({ rows }: { rows: MasterCoachRow[] }) {
  const [selected, setSelected] = useState<MasterCoachRow | null>(null);

  const columns: Column<MasterCoachRow>[] = [
    { key: "coach", header: "Coach", cell: (c) => <PersonCell name={c.name} /> },
    { key: "email", header: "Email", cell: (c) => <span className="text-muted-foreground">{c.email}</span> },
    { key: "phone", header: "Phone", cell: (c) => <span className="text-muted-foreground">{c.phone ?? "—"}</span> },
    {
      key: "club",
      header: "Club",
      cell: (c) => (c.clubs.length ? c.clubs.map((cl) => cl.name).join(", ") : <span className="text-muted-foreground">—</span>),
    },
    {
      key: "teams",
      header: "Team(s)",
      cell: (c) =>
        c.teams.length ? (
          <span className="flex flex-wrap gap-1">
            {c.teams.map((t) => (
              <span key={t.teamId} className="rounded-full border bg-card px-2 py-0.5 text-xs">
                {t.teamName}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "roleType",
      header: "Role Type",
      cell: (c) => (c.roleTypes.length ? c.roleTypes.map(roleLabel).join(", ") : <span className="text-muted-foreground">—</span>),
    },
    { key: "status", header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
    { key: "lastLogin", header: "Last Login", cell: (c) => <span className="text-muted-foreground">{fmtDate(c.lastLoginAt)}</span> },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      cell: (c) => <ActionsMenu items={[{ label: "View", onSelect: () => setSelected(c) }]} />,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(c) => c.userId}
        onRowClick={(c) => setSelected(c)}
        emptyMessage="No coaches match your filters."
      />
      <CoachDetailDrawer coach={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </>
  );
}
