import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { getOwnChild, listLinkedChildren } from "@/modules/roster/service";

import { StatusBadge } from "../../seasons/season-forms";
import { ChildEditForm } from "./child-edit-client";

export default async function ChildProfilePage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const ctx = await requireRole("PARENT");

  const [child, siblings] = await Promise.all([getOwnChild(ctx, playerId), listLinkedChildren(ctx)]);
  if (!child) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← My Kids
      </Link>

      {siblings.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {siblings.map((s) => (
            <Link
              key={s.id}
              href={`/my-kids/${s.id}`}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                s.id === child.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-sidebar-accent"
              }`}
            >
              {s.displayName}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">{child.displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {child.firstName} {child.lastName}
            {child.jerseyNumber ? ` · #${child.jerseyNumber}` : ""}
            {child.primaryPosition ? ` · ${child.primaryPosition}` : ""}
            {child.secondaryPosition ? ` / ${child.secondaryPosition}` : ""}
            {child.dateOfBirth ? ` · DOB ${child.dateOfBirth}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={child.status} />
          <ChildEditForm
            child={{
              id: child.id,
              preferredName: child.preferredName,
              photoUrl: child.photoUrl,
              emergencyContactName: child.emergencyContactName,
              emergencyContactPhone: child.emergencyContactPhone,
              medicalNotes: child.medicalNotes,
              allergyNotes: child.allergyNotes,
            }}
          />
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Care details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Emergency contact" value={child.emergencyContactName} />
          <Detail label="Emergency phone" value={child.emergencyContactPhone} />
          <Detail label="Medical notes" value={child.medicalNotes} />
          <Detail label="Allergy notes" value={child.allergyNotes} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Teams</CardTitle>
        </CardHeader>
        <CardContent>
          {child.teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not on any team yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {child.teams.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
                  <span className="font-medium text-foreground">{t.name}</span>
                  <Link
                    href={`/my-kids/${child.id}/roster/${t.id}`}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    View team roster
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground">{value || "—"}</p>
    </div>
  );
}
