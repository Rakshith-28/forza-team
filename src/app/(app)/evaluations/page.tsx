import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { listTeams } from "@/modules/clubs/service";
import { listCycles, listTemplates } from "@/modules/evaluations/service";
import { CYCLE_TYPE_LABELS } from "@/modules/evaluations/schemas";

import { StatusBadge } from "../seasons/season-forms";
import { CreateCycleForm, CreateTemplateForm } from "./eval-forms";

export default async function EvaluationsPage() {
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN", "COACH");
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const clubId = ctx.activeClubId;
  const canManage = can(ctx, "evaluations.manage_templates", { clubId });
  const [templates, cycles, teams] = await Promise.all([
    listTemplates(ctx, clubId),
    listCycles(ctx, clubId),
    canManage ? listTeams(ctx, clubId) : Promise.resolve([]),
  ]);
  const teamOptions = teams.filter((t) => t.status !== "ARCHIVED").map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Evaluations</h1>
          <p className="mt-1 text-muted-foreground">
            {canManage ? "Configure templates and cycles; coaches score players." : "Score players for the active cycles."}
          </p>
        </div>
        <Link
          href="/evaluations/compare"
          className="rounded-md border px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-secondary"
        >
          Compare players
        </Link>
      </div>

      {/* Templates */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-sport text-base">Templates</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {templates.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/evaluations/templates/${t.id}`}
                      className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm transition-colors hover:border-primary"
                    >
                      <span className="font-medium text-foreground">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.criteria.length} criteria</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {canManage ? (
              <div className="border-t pt-3">
                <CreateTemplateForm />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Cycles */}
        <Card>
          <CardHeader>
            <CardTitle className="font-sport text-base">Cycles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {cycles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cycles yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {cycles.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{c.name}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {CYCLE_TYPE_LABELS[c.cycleType as keyof typeof CYCLE_TYPE_LABELS] ?? c.cycleType}
                        {c.team ? ` · ${c.team.name}` : " · Club-wide"}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
            {canManage ? (
              <div className="border-t pt-3">
                <CreateCycleForm teams={teamOptions} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        To score a player, open a player from the{" "}
        <Link href="/players" className="underline underline-offset-4">
          roster
        </Link>{" "}
        and choose <strong>Evaluate</strong>.
      </p>
    </div>
  );
}
