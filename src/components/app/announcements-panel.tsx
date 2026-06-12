"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Pin } from "lucide-react";

import { StatusBadge } from "@/components/console";
import { cn } from "@/lib/utils";

/** Max announcements shown inline on a dashboard before linking out to the full list. */
const MAX_VISIBLE = 2;
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
  PLAYERS_ONLY: "Players",
};

export interface AnnouncementPanelItem {
  id: string;
  source: "platform" | "club";
  title: string;
  body: string;
  /** Platform severity (INFO/WARNING/CRITICAL) or, for club items, the audience code. */
  badge: string | null;
  pinned?: boolean;
  /** Author flagged this as important (club announcements). */
  important?: boolean;
  read: boolean;
  date: Date | string | null;
}

function fmt(d: Date | string | null): string {
  if (!d) return "";
  const date = new Date(d);
  const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

/**
 * Unified announcements feed for a dashboard: merges platform broadcasts and the
 * caller's club/team announcements into one list (unread first, then newest).
 * Opening an item reveals its body and marks it read via the right action for
 * its source. Fixes the gap where club-admin announcements never surfaced on the
 * dashboard (only the bell merged both).
 */
export function AnnouncementsPanel({
  items,
  viewAllHref = "/announcements",
  className,
}: {
  items: AnnouncementPanelItem[];
  /** Where "Show more" links when there are more than MAX_VISIBLE items. */
  viewAllHref?: string;
  /** Override the panel surface (e.g. a glass treatment). */
  className?: string;
}) {
  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
          Number(a.read) - Number(b.read) ||
          new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
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
    <section data-glass className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-sport text-base font-bold tracking-tight text-foreground">Announcements</h2>
        <div className="flex shrink-0 items-center gap-2">
          {liveUnread > 0 ? (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {liveUnread} new
            </span>
          ) : null}
          <Link href={viewAllHref} className="text-xs font-semibold text-primary hover:underline">
            Show more →
          </Link>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          No announcements right now.
        </p>
      ) : (
        <ul className="mt-3 divide-y">
            {sorted.slice(0, MAX_VISIBLE).map((item) => {
              const isRead = readIds.has(item.id);
              const isOpen = openId === item.id;
              const badgeText =
                item.source === "platform" ? item.badge ?? "" : AUDIENCE_LABEL[item.badge ?? ""] ?? "Club";
              const badgeTone =
                item.source === "platform" ? SEVERITY_TONE[item.badge ?? ""] ?? "" : "bg-secondary text-secondary-foreground";
              return (
                <li
                  key={`${item.source}-${item.id}`}
                  className={item.important && !isRead ? "-mx-2 rounded-lg border-l-2 border-destructive bg-destructive/5 px-2" : ""}
                >
                  <button
                    type="button"
                    onClick={() => open(item)}
                    className="flex w-full items-start gap-2.5 py-2.5 text-left"
                  >
                    {/* Status rail: unread dot, then pin/important markers. */}
                    <span className="mt-1 flex shrink-0 items-center gap-1">
                      {!isRead ? (
                        <span className="size-2 rounded-full bg-primary" aria-label="Unread" />
                      ) : (
                        <span className="size-2" />
                      )}
                      {item.pinned ? <Pin className="size-3.5 text-primary" aria-label="Pinned" /> : null}
                      {item.important ? (
                        <AlertTriangle className="size-3.5 text-destructive" aria-label="Important" />
                      ) : null}
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      {/* Title + badges */}
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                          {item.title}
                        </span>
                        {item.important ? (
                          <StatusBadge status="Important" className="bg-destructive/10 text-destructive" />
                        ) : null}
                        {badgeText ? <StatusBadge status={badgeText} className={badgeTone} /> : null}
                      </span>
                      {/* Body — aligned under the title; one line when collapsed, full when open. */}
                      <span
                        className={`text-xs text-muted-foreground ${isOpen ? "whitespace-pre-wrap" : "truncate"}`}
                      >
                        {item.body}
                      </span>
                    </span>

                    <span suppressHydrationWarning className="shrink-0 whitespace-nowrap pt-0.5 text-xs text-muted-foreground">
                      {fmt(item.date)}
                    </span>
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}
