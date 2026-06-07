"use client";

import { useState } from "react";

import { ActionsMenu, DataTable, PersonCell, StatusBadge, type Column } from "@/components/console";
import { ROLE_LABELS, isRole } from "@/lib/rbac";
import type { MasterUserRow } from "@/modules/master/service";

import { UserDetailDrawer } from "./user-detail-drawer";

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function roleLabel(code: string): string {
  return isRole(code) ? ROLE_LABELS[code] : code;
}

export function UsersTable({ rows }: { rows: MasterUserRow[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const columns: Column<MasterUserRow>[] = [
    { key: "name", header: "Name", cell: (u) => <PersonCell name={u.name} /> },
    { key: "email", header: "Email", cell: (u) => <span className="text-muted-foreground">{u.email}</span> },
    {
      key: "roles",
      header: "Role(s)",
      cell: (u) => (u.roleCodes.length ? u.roleCodes.map(roleLabel).join(", ") : <span className="text-muted-foreground">—</span>),
    },
    {
      key: "club",
      header: "Club",
      cell: (u) => (u.clubNames.length ? u.clubNames.join(", ") : <span className="text-muted-foreground">—</span>),
    },
    { key: "status", header: "Status", cell: (u) => <StatusBadge status={u.status} /> },
    { key: "lastLogin", header: "Last Login", cell: (u) => <span suppressHydrationWarning className="text-muted-foreground">{fmtDate(u.lastLoginAt)}</span> },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      cell: (u) => <ActionsMenu items={[{ label: "View", onSelect: () => setSelected(u.userId) }]} />,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(u) => u.userId}
        onRowClick={(u) => setSelected(u.userId)}
        emptyMessage="No users match your filters."
      />
      <UserDetailDrawer userId={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </>
  );
}
