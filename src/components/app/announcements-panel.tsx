"use client";

import { useMemo, useState, useTransition } from "react";

import { StatusBadge } from "@/components/console";
import { markClubAnnouncementReadAction } from "@/modules/comms/actions";
import { markPlatformAnnouncementReadAction } from "@/modules/announcements/platform-actions";

const SEVERITY_TONE: Record<string, string> = {
  INFO: "bg-sky-100 text-sky-700",
  WARNING: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-destructive/10 text-destructive",
};

const AUDIENCE_LABEL: Record<string, string> = {
  CLUB_ALL: "Club",
  TEAM_ONLY: "Team",
  COACHES_ONLY: "Coaches",
  PARENTS_ONLY: "Parents",
};

export interface AnnouncementPanelItem {
  id: string;
  source: "platform" | "club";
  title: string;
  body: string;
  /** Platform severity (INFO/WARNING/CRITICAL) or, for club items, the audience code. */
  badge: string | null;
  pinned?: boolean;
  read: boolean;
  date: Date | string | null;
}

function fmt(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Unified announcements feed for a dashboard: merges platform broadcasts and the
 * caller's club/team announcements into one list (unread first, then newest).
 * Opening an item reveals its body and marks it read via the right action for
 * its source. Fixes the gap where club-admin announcements never surfaced on the
 * dashboard (only the bell merged both).
 */
export function AnnouncementsPanel({ items }: { items: AnnouncementPanelItem[] }) {
  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => Number(a.read) - Number(b.read) || (new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()),
      ),
    [items],
  );

  const [readIds, setReadIds] = useState<Set<string>>(new Set(items.filter((i) => i.read).map((i) => i.id)));
  const [openId, setOpenId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function open(item: AnnouncementPanelItem) {
    setOpenId((cur) => (cur === item.id ? null : item.id));
    if (!readIds.has(item.id)) {
      setReadIds((prev) => new Set(prev).add(item.id));
      startTransition(() => {
        void (item.source === "platform"
          ? markPlatformAnnouncementReadAction(item.id)
          : markClubAnnouncementReadAction(item.id));
      });
    }
  }

  const liveUnread = sorted.filter((i) => !readIds.has(i.id)).length;

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-sport text-base font-bold tracking-tight text-foreground">Announcements</h2>
        {liveUnread > 0 ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {liveUnread} new
          </span>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          No announcements right now.
        </p>
      ) : (
        <ul className="mt-3 divide-y">
          {sorted.map((item) => {
            const isRead = readIds.has(item.id);
            const isOpen = openId === item.id;
            const badgeText =
              item.source === "platform" ? item.badge ?? "" : AUDIENCE_LABEL[item.badge ?? ""] ?? "Club";
            const badgeTone =
              item.source === "platform" ? SEVERITY_TONE[item.badge ?? ""] ?? "" : "bg-secondary text-secondary-foreground";
            return (
              <li key={`${item.source}-${item.id}`}>
                <button
                  type="button"
                  onClick={() => open(item)}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  {!isRead ? (
                    <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                  ) : (
                    <span className="size-2 shrink-0" />
                  )}
                  {badgeText ? <StatusBadge status={badgeText} className={badgeTone} /> : null}
                  <span
                    className={`min-w-0 flex-1 truncate text-sm ${isRead ? "text-foreground" : "font-semibold text-foreground"}`}
                  >
                    {item.pinned ? "📌 " : ""}
                    {item.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmt(item.date)}</span>
                </button>
                {isOpen ? (
                  <p className="whitespace-pre-wrap pb-3 pl-5 text-sm text-muted-foreground">{item.body}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
