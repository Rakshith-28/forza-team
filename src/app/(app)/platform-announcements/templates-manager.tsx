"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createPlatformTemplateAction,
  deletePlatformTemplateAction,
  updatePlatformTemplateAction,
} from "@/modules/announcements/platform-actions";
import { AUDIENCE_ROLE_CODES, AUDIENCE_SCOPES, SEVERITIES, SEVERITY_LABELS } from "@/modules/announcements/platform-schemas";
import type { PlatformTemplateRow } from "@/modules/announcements/platform-service";
import { ROLE_LABELS, isRole } from "@/lib/rbac";

import { SeverityBadge } from "./severity-badge";

const textareaCls =
  "min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

interface Draft {
  id?: string;
  name: string;
  title: string;
  body: string;
  severity: string;
  defaultAudienceScope: string;
  defaultAudienceRoles: string[];
}
const EMPTY: Draft = { name: "", title: "", body: "", severity: "INFO", defaultAudienceScope: "ALL_CLUBS", defaultAudienceRoles: ["CLUB_ADMIN"] };

function roleLabel(code: string): string {
  return isRole(code) ? ROLE_LABELS[code] : code;
}

export function TemplatesManager({ templates }: { templates: PlatformTemplateRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = !!draft.id;

  function toggleRole(code: string) {
    setDraft((p) => ({
      ...p,
      defaultAudienceRoles: p.defaultAudienceRoles.includes(code)
        ? p.defaultAudienceRoles.filter((r) => r !== code)
        : [...p.defaultAudienceRoles, code],
    }));
  }

  function save() {
    setError(null);
    const payload = {
      name: draft.name,
      title: draft.title,
      body: draft.body,
      severity: draft.severity,
      defaultAudienceScope: draft.defaultAudienceScope,
      defaultAudienceRoles: draft.defaultAudienceRoles,
    };
    startTransition(async () => {
      const res = editing
        ? await updatePlatformTemplateAction(draft.id!, payload)
        : await createPlatformTemplateAction(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft(EMPTY);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deletePlatformTemplateAction(id);
      if (draft.id === id) setDraft(EMPTY);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Templates</h3>
        {templates.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            No templates yet. Create one to reuse in the composer.
          </p>
        ) : (
          <ul className="mt-2 divide-y rounded-lg border bg-card">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <SeverityBadge severity={t.severity} />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        id: t.id,
                        name: t.name,
                        title: t.title,
                        body: t.body,
                        severity: t.severity,
                        defaultAudienceScope: t.defaultAudienceScope,
                        defaultAudienceRoles: t.defaultAudienceRoles,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => remove(t.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border bg-secondary/30 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {editing ? "Edit template" : "New template"}
        </h3>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-name">Name</Label>
            <Input id="t-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-body">Body</Label>
            <textarea id="t-body" className={textareaCls} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-sev">Severity</Label>
              <Select id="t-sev" value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-scope">Default audience</Label>
              <Select id="t-scope" value={draft.defaultAudienceScope} onChange={(e) => setDraft({ ...draft, defaultAudienceScope: e.target.value })}>
                {AUDIENCE_SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {s === "ALL_CLUBS" ? "All clubs" : "Specific clubs"}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Default roles</Label>
            <div className="flex flex-wrap gap-3">
              {AUDIENCE_ROLE_CODES.map((code) => (
                <label key={code} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={draft.defaultAudienceRoles.includes(code)} onChange={() => toggleRole(code)} className="size-4" />
                  {roleLabel(code)}
                </label>
              ))}
            </div>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? "Saving…" : editing ? "Update template" : "Create template"}
            </Button>
            {editing ? (
              <Button type="button" variant="outline" onClick={() => setDraft(EMPTY)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
