import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { getOwnChild } from "@/modules/roster/service";
import { getOwnChildEvaluationSummary, parentEvaluationViewEnabled } from "@/modules/evaluations/service";

export default async function ChildEvaluationsPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const ctx = await requireRole("PARENT");

  // Validates that this is the parent's own linked child.
  const child = await getOwnChild(ctx, playerId);
  if (!child) notFound();

  const enabled = ctx.activeClubId ? await parentEvaluationViewEnabled(ctx.activeClubId) : false;
  const summaries = enabled ? await getOwnChildEvaluationSummary(ctx, playerId) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/my-kids/${playerId}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← {child.displayName}
      </Link>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-tight text-foreground">Evaluations</h1>
      <p className="mt-1 text-sm text-muted-foreground">{child.displayName}</p>

      {!enabled ? (
        <p className="mt-6 rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Your club hasn&apos;t enabled sharing player evaluations with parents.
        </p>
      ) : summaries.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No evaluations have been shared yet.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {summaries.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between font-sport text-base">
                  <span>{s.cycleName}</span>
                  {s.overallScore != null ? (
                    <span className="font-sport text-2xl font-extrabold text-primary">{s.overallScore.toFixed(1)}</span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {s.summaryComment ? (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Summary</p>
                    <p className="whitespace-pre-wrap text-foreground">{s.summaryComment}</p>
                  </div>
                ) : null}
                {s.parentVisibleNotes ? (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                    <p className="whitespace-pre-wrap text-foreground">{s.parentVisibleNotes}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
