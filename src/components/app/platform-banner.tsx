"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { dismissPlatformAnnouncementAction } from "@/modules/announcements/platform-actions";

export interface BannerItem {
  id: string;
  title: string;
  body: string;
  severity: string;
}

const TONE: Record<string, string> = {
  CRITICAL: "border-destructive/30 bg-destructive/10 text-destructive",
  WARNING: "border-amber-300 bg-amber-100 text-amber-800",
};

/**
 * Platform system-alerts strip — live WARNING/CRITICAL broadcasts the user hasn't
 * dismissed. Always shown (platform notices), styled by severity. Dismiss writes
 * a read row's dismissed_at and removes it locally.
 */
export function PlatformBanner({ items }: { items: BannerItem[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const visible = items.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  function dismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    startTransition(() => {
      void dismissPlatformAnnouncementAction(id);
    });
  }

  return (
    <div className="mb-4 flex flex-col gap-2">
      {visible.map((item) => (
        <div
          key={item.id}
          role="alert"
          className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", TONE[item.severity] ?? TONE.WARNING)}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-0.5 line-clamp-2 text-sm opacity-90">{item.body}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(item.id)}
            className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
