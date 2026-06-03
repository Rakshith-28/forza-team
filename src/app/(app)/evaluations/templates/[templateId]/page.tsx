import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { can } from "@/lib/rbac";
import { getTemplate } from "@/modules/evaluations/service";

import { AddCriterionForm, EditCriterionForm, TemplateNameForm } from "./criterion-forms";

export default async function TemplateDetailPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN", "COACH");

  const template = await getTemplate(ctx, templateId);
  if (!template) notFound();

  const canManage = can(ctx, "evaluations.manage_templates", { clubId: template.clubId });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/evaluations" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← Evaluations
      </Link>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-tight text-foreground">{template.name}</h1>
      {template.description ? <p className="mt-1 text-sm text-muted-foreground">{template.description}</p> : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Criteria</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {template.criteria.length === 0 ? (
            <p className="text-sm text-muted-foreground">No criteria.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {template.criteria.map((c) =>
                canManage ? (
                  <li key={c.id}>
                    <EditCriterionForm
                      templateId={template.id}
                      criterion={{
                        id: c.id,
                        code: c.code,
                        label: c.label,
                        minScore: Number(c.minScore),
                        maxScore: Number(c.maxScore),
                        isActive: c.isActive,
                      }}
                    />
                  </li>
                ) : (
                  <li key={c.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                    <span className="font-medium text-foreground">{c.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {Number(c.minScore)}–{Number(c.maxScore)}
                      {c.isActive ? "" : " · inactive"}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
          {canManage ? (
            <div className="border-t pt-4">
              <AddCriterionForm templateId={template.id} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canManage ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="font-sport text-base">Template settings</CardTitle>
          </CardHeader>
          <CardContent>
            <TemplateNameForm templateId={template.id} name={template.name} description={template.description} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
