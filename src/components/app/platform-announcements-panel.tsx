"use client";

import { useState, useTransition } from "react";

import { StatusBadge } from "@/components/console";
import { markPlatformAnnouncementReadAction } from "@/modules/announcements/platform-actions";
import type { MyPlatformAnnouncement } from "@/modules/announcements/platform-service";

const TONE: Record<string, string> = {
  INFO: "bg-sky-100 text-sky-700",
  WARNING: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-destructive/10 text-destructive",
};

function fmt(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Recipient "Platform announcements" feed (dashboard panel). Lists the platform
 * broadcasts visible to the user; opening one marks it read and reveals the body.
 * The in-app feed always shows regardless of notification preferences.
 */
export function PlatformAnnouncementsPanel({
  items,
  unread,
}: {
  items: MyPlatformAnnouncement[];
  unread: number;
}) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set(items.filter((i) => i.read).map((i) => i.id)));
  const [openId, setOpenId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function open(id: string) {
    setOpenId((cur) => (cur === id ? null : id));
    if (!readIds.has(id)) {
      setReadIds((prev) => new Set(prev).add(id));
      startTransition(() => {
        void markPlatformAnnouncementReadAction(id);
      });
    }
  }

  const liveUnread = items.filter((i) => !readIds.has(i.id)).length || unread;

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-sport text-base font-bold tracking-tight text-foreground">Platform announcements</h2>
        {liveUnread > 0 ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{liveUnread} new</span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          No announcements right now.
        </p>
      ) : (
        <ul className="mt-3 divide-y">
          {items.map((item) => {
            const isRead = readIds.has(item.id);
            const isOpen = openId === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => open(item.id)}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  {!isRead ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : <span className="size-2 shrink-0" />}
                  <StatusBadge status={item.severity} className={TONE[item.severity] ?? ""} />
                  <span className={`min-w-0 flex-1 truncate text-sm ${isRead ? "text-foreground" : "font-semibold text-foreground"}`}>
                    {item.pinned ? "📌 " : ""}
                    {item.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmt(item.publishedAt)}</span>
                </button>
                {isOpen ? <p className="whitespace-pre-wrap pb-3 pl-5 text-sm text-muted-foreground">{item.body}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
