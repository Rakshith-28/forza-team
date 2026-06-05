"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";
import { loadAnnouncementInboxAction, markInboxItemReadAction } from "@/modules/announcements/inbox-actions";
import type { InboxItem } from "@/modules/announcements/inbox";

function fmt(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Navbar announcements bell — combined unread (platform + club) badge with a
 * lazy-loaded dropdown. Opening an item marks it read; club items deep-link to
 * the announcements page. Works in any shell (console + parent).
 */
export function AnnouncementsBell({ initialCount }: { initialCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      setLoading(true);
      loadAnnouncementInboxAction()
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }
  }

  function openItem(item: InboxItem) {
    if (!item.read) {
      setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, read: true } : i)) ?? prev);
      setCount((c) => Math.max(0, c - 1));
      startTransition(() => {
        void markInboxItemReadAction(item.source, item.id);
      });
    }
    if (item.source === "club") {
      setOpen(false);
      router.push("/announcements");
    }
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`Announcements${count > 0 ? `, ${count} unread` : ""}`}
        aria-expanded={open}
        onClick={toggle}
        className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Bell className="size-5" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border bg-popover shadow-lg"
          >
            <div className="border-b px-4 py-2.5">
              <p className="text-sm font-semibold text-foreground">Announcements</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
              ) : !items || items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
              ) : (
                <ul className="divide-y">
                  {items.map((item) => (
                    <li key={`${item.source}-${item.id}`}>
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-secondary/60"
                      >
                        <span className={cn("mt-1 size-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-primary")} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {item.source}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">{fmt(item.date)}</span>
                          </span>
                          <span className={cn("mt-0.5 block truncate text-sm", item.read ? "text-muted-foreground" : "font-medium text-foreground")}>
                            {item.title}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link
              href="/announcements"
              onClick={() => setOpen(false)}
              className="block border-t px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-secondary/60"
            >
              View all announcements
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
