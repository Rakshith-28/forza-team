import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthContext } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { deleteClubDocumentAction } from "@/modules/files/actions";
import { listClubDocuments } from "@/modules/files/service";

import { UploadDocumentForm } from "./document-forms";

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
  const canManage = can(ctx, "documents.manage_club", { clubId });
  const documents = await listClubDocuments(ctx, clubId);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Documents</h1>
      <p className="mt-1 text-muted-foreground">Club-shared files. Team files are shared in team chat.</p>

      {canManage ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-sport text-base">Upload a club document</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadDocumentForm />
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {documents.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No documents shared yet.
          </p>
        ) : (
          documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
              <a
                href={`/api/files/${d.id}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1"
              >
                <p className="truncate font-medium text-foreground hover:underline">📄 {d.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtSize(d.sizeBytes)} · {d.createdAt.toISOString().slice(0, 10)}
                </p>
              </a>
              {canManage ? (
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
    </div>
  );
}
