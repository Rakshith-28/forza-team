import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthContext } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { listTeams } from "@/modules/clubs/service";
import { deleteClubDocumentAction, deleteTeamDocumentAction } from "@/modules/files/actions";
import { listAccessibleTeamDocuments, listClubDocuments } from "@/modules/files/service";

import { UploadDocumentForm, UploadTeamDocumentForm } from "./document-forms";

function fmtSize(bytes: bigint): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const ctx = await requireAuthContext();
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const clubId = ctx.activeClubId;
  const canManageClub = can(ctx, "documents.manage_club", { clubId });
  const canManageTeam = can(ctx, "documents.manage_team", { clubId });

  const [clubDocs, teamDocs, manageableTeams] = await Promise.all([
    listClubDocuments(ctx, clubId),
    listAccessibleTeamDocuments(ctx, clubId),
    canManageTeam ? listTeams(ctx, clubId) : Promise.resolve([]),
  ]);
  const teamOptions = manageableTeams
    .filter((t) => t.status !== "ARCHIVED")
    .map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Documents</h1>
      <p className="mt-1 text-muted-foreground">Club-shared and team files.</p>

      {canManageClub ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-sport text-base">Upload a club document</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadDocumentForm />
          </CardContent>
        </Card>
      ) : null}

      {canManageTeam && teamOptions.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="font-sport text-base">Upload a team document</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadTeamDocumentForm teams={teamOptions} />
          </CardContent>
        </Card>
      ) : null}

      <h2 className="mt-8 font-sport text-sm font-bold uppercase tracking-wide text-muted-foreground">Club documents</h2>
      <div className="mt-3 flex flex-col gap-3">
        {clubDocs.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No club documents shared yet.
          </p>
        ) : (
          clubDocs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
              <a href={`/api/files/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground hover:underline">📄 {d.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtSize(d.sizeBytes)} · {d.createdAt.toISOString().slice(0, 10)}
                </p>
              </a>
              {canManageClub ? (
                <form action={deleteClubDocumentAction}>
                  <input type="hidden" name="fileId" value={d.id} />
                  <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-destructive">
                    Delete
                  </button>
                </form>
              ) : null}
            </div>
          ))
        )}
      </div>

      <h2 className="mt-8 font-sport text-sm font-bold uppercase tracking-wide text-muted-foreground">Team documents</h2>
      <div className="mt-3 flex flex-col gap-3">
        {teamDocs.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No team documents available to you.
          </p>
        ) : (
          teamDocs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
              <a href={`/api/files/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground hover:underline">📄 {d.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {d.team?.name ?? "Team"} · {fmtSize(d.sizeBytes)} · {d.createdAt.toISOString().slice(0, 10)}
                </p>
              </a>
              {canManageTeam ? (
                <form action={deleteTeamDocumentAction}>
                  <input type="hidden" name="fileId" value={d.id} />
                  <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-destructive">
                    Delete
                  </button>
                </form>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
