"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createPlatformAnnouncementAction,
  createPlatformTemplateAction,
  updatePlatformAnnouncementAction,
  type RawAnnouncementInput,
} from "@/modules/announcements/platform-actions";
import { AUDIENCE_ROLE_CODES, AUDIENCE_SCOPES, SEVERITIES, SEVERITY_LABELS } from "@/modules/announcements/platform-schemas";
import type { PlatformTemplateRow } from "@/modules/announcements/platform-service";
import { ROLE_LABELS, isRole } from "@/lib/rbac";

export interface ComposerInitial {
  id?: string;
  title: string;
  body: string;
  severity: string;
  audienceScope: string;
  audienceRoles: string[];
  clubIds: string[];
  scheduledAt: string | null; // datetime-local value
  expiresAt: string | null;
  pinned: boolean;
}

const EMPTY: ComposerInitial = {
  title: "",
  body: "",
  severity: "INFO",
  audienceScope: "ALL_CLUBS",
  audienceRoles: ["CLUB_ADMIN"],
  clubIds: [],
  scheduledAt: null,
  expiresAt: null,
  pinned: false,
};

const textareaCls =
  "min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function roleLabel(code: string): string {
  return isRole(code) ? ROLE_LABELS[code] : code;
}

export function ComposerDialog({
  open,
  onOpenChange,
  clubOptions,
  templates,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubOptions: { id: string; name: string }[];
  templates: PlatformTemplateRow[];
  initial?: ComposerInitial;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open ? (
          <ComposerForm
            key={initial?.id ?? "new"}
            clubOptions={clubOptions}
            templates={templates}
            initial={initial ?? EMPTY}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <DialogTitle className="sr-only">Composer</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ComposerForm({
  clubOptions,
  templates,
  initial,
  onDone,
}: {
  clubOptions: { id: string; name: string }[];
  templates: PlatformTemplateRow[];
  initial: ComposerInitial;
  onDone: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState<ComposerInitial>(initial);
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = !!initial.id;

  function set<K extends keyof ComposerInitial>(key: K, value: ComposerInitial[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
  }
  function toggleRole(code: string) {
    setV((prev) => ({
      ...prev,
      audienceRoles: prev.audienceRoles.includes(code)
        ? prev.audienceRoles.filter((r) => r !== code)
        : [...prev.audienceRoles, code],
    }));
  }
  function toggleClub(id: string) {
    setV((prev) => ({
      ...prev,
      clubIds: prev.clubIds.includes(id) ? prev.clubIds.filter((c) => c !== id) : [...prev.clubIds, id],
    }));
  }

  function loadTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setV((prev) => ({
      ...prev,
      title: t.title,
      body: t.body,
      severity: t.severity,
      audienceScope: t.defaultAudienceScope,
      audienceRoles: t.defaultAudienceRoles,
    }));
    setNotice(`Loaded template "${t.name}".`);
  }

  function payload(publishNow: boolean): RawAnnouncementInput {
    return {
      title: v.title,
      body: v.body,
      severity: v.severity,
      audienceScope: v.audienceScope,
      audienceRoles: v.audienceRoles,
      clubIds: v.clubIds,
      scheduledAt: v.scheduledAt || null,
      expiresAt: v.expiresAt || null,
      pinned: v.pinned,
      publishNow,
    };
  }

  function submit(publishNow: boolean) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = editing
        ? await updatePlatformAnnouncementAction(initial.id!, payload(publishNow))
        : await createPlatformAnnouncementAction(payload(publishNow));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  function saveAsTemplate() {
    setError(null);
    setNotice(null);
    if (!templateName.trim()) {
      setError("Enter a template name to save.");
      return;
    }
    startTransition(async () => {
      const res = await createPlatformTemplateAction({
        name: templateName,
        title: v.title,
        body: v.body,
        severity: v.severity,
        defaultAudienceScope: v.audienceScope,
        defaultAudienceRoles: v.audienceRoles,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTemplateName("");
      setNotice("Saved as template.");
      router.refresh();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit announcement" : "New platform announcement"}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="flex flex-col gap-4">
          {templates.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-template">Load template</Label>
              <Select id="c-template" defaultValue="" onChange={(e) => e.target.value && loadTemplate(e.target.value)}>
                <option value="">— Start from scratch —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-title">Title</Label>
            <Input id="c-title" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={200} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-body">Body</Label>
            <textarea id="c-body" className={textareaCls} value={v.body} onChange={(e) => set("body", e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-sev">Severity</Label>
              <Select id="c-sev" value={v.severity} onChange={(e) => set("severity", e.target.value)}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-scope">Audience</Label>
              <Select id="c-scope" value={v.audienceScope} onChange={(e) => set("audienceScope", e.target.value)}>
                {AUDIENCE_SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {s === "ALL_CLUBS" ? "All clubs" : "Specific clubs"}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {v.audienceScope === "SPECIFIC_CLUBS" ? (
            <div className="flex flex-col gap-1.5">
              <Label>Clubs ({v.clubIds.length} selected)</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                {clubOptions.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">No clubs available.</p>
                ) : (
                  clubOptions.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                      <input type="checkbox" checked={v.clubIds.includes(c.id)} onChange={() => toggleClub(c.id)} className="size-4" />
                      {c.name}
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label>Roles that see it</Label>
            <div className="flex flex-wrap gap-3">
              {AUDIENCE_ROLE_CODES.map((code) => (
                <label key={code} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={v.audienceRoles.includes(code)} onChange={() => toggleRole(code)} className="size-4" />
                  {roleLabel(code)}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-sched">Schedule for (optional)</Label>
              <Input
                id="c-sched"
                type="datetime-local"
                value={v.scheduledAt ?? ""}
                onChange={(e) => set("scheduledAt", e.target.value || null)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-exp">Expires at (optional)</Label>
              <Input
                id="c-exp"
                type="datetime-local"
                value={v.expiresAt ?? ""}
                onChange={(e) => set("expiresAt", e.target.value || null)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.pinned} onChange={(e) => set("pinned", e.target.checked)} className="size-4" />
            Pin to top of recipients&apos; feed
          </label>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="text-sm text-primary" role="status">
              {notice}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button type="button" disabled={pending} onClick={() => submit(true)}>
              {pending ? "Working…" : "Publish now"}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => submit(false)}>
              {v.scheduledAt ? "Save schedule" : "Save draft"}
            </Button>
          </div>

          <div className="flex items-end gap-2 rounded-lg border bg-secondary/30 p-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="c-tplname">Save as template</Label>
              <Input id="c-tplname" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" />
            </div>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={saveAsTemplate}>
              Save template
            </Button>
          </div>
        </div>
      </DialogBody>
    </>
  );
}
