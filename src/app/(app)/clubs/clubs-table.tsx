"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import {
  ActionsMenu,
  DataTable,
  PersonCell,
  StatusBadge,
  type Column,
} from "@/components/console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/console";
import { INITIAL_STATE } from "@/modules/clubs/action-state";
import { updateClubAction } from "@/modules/clubs/actions";
import { toggleClubStatusAction } from "@/modules/master/actions";
import type { MasterClubListItem } from "@/modules/master/service";

import { ClubAdminBadge } from "./admin-badge";
import { ClubDetailDrawer } from "./club-detail-drawer";

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ClubsTable({ rows }: { rows: MasterClubListItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<MasterClubListItem | null>(null);
  const [, startTransition] = useTransition();

  function toggleStatus(club: MasterClubListItem) {
    const next = club.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    startTransition(async () => {
      await toggleClubStatusAction(club.id, next);
      router.refresh();
    });
  }

  const columns: Column<MasterClubListItem>[] = [
    {
      key: "name",
      header: "Club Name",
      cell: (c) => <PersonCell name={c.name} subtext={c.shortCode} imageUrl={c.logoUrl} />,
    },
    { key: "shortCode", header: "Short Code", cell: (c) => <span className="text-muted-foreground">{c.shortCode}</span> },
    {
      key: "status",
      header: "Status",
      cell: (c) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={c.status} />
          <ClubAdminBadge state={c.adminState} />
        </div>
      ),
    },
    { key: "teams", header: "Teams", className: "text-right tabular-nums", cell: (c) => c.teamCount },
    { key: "users", header: "Users", className: "text-right tabular-nums", cell: (c) => c.userCount },
    { key: "created", header: "Created", cell: (c) => <span suppressHydrationWarning className="text-muted-foreground">{fmtDate(c.createdAt)}</span> },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      cell: (c) => (
        <ActionsMenu
          items={[
            { label: "View", onSelect: () => setSelected(c.id) },
            { label: "Edit name", onSelect: () => setEditing(c) },
            c.status === "ACTIVE"
              ? { label: "Suspend", onSelect: () => toggleStatus(c), destructive: true }
              : { label: "Activate", onSelect: () => toggleStatus(c) },
            { label: "Impersonate Club Admin", disabled: true, title: "Impersonation is not available yet (TODO)." },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(c) => c.id}
        onRowClick={(c) => setSelected(c.id)}
        emptyMessage="No clubs match your filters."
      />

      <ClubDetailDrawer clubId={selected} onOpenChange={(open) => !open && setSelected(null)} />

      <EditClubDialog club={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function EditClubDialog({ club, onClose }: { club: MasterClubListItem | null; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateClubAction, INITIAL_STATE);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      onClose();
      router.refresh();
    }
    // Only react to a successful save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={club != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {club ? (
          <>
            <DialogHeader>
              <DialogTitle>Edit club</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <form action={action} className="flex flex-col gap-3">
                <input type="hidden" name="clubId" value={club.id} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-club-name">Club name</Label>
                  <Input id="edit-club-name" name="name" defaultValue={club.name} required />
                </div>
                {state.error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {state.error}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button type="submit" disabled={pending}>
                    {pending ? "Saving…" : "Save"}
                  </Button>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogBody>
          </>
        ) : (
          <DialogTitle className="sr-only">Edit club</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}
