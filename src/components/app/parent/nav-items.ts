import { Bell, CalendarDays, Home, MessageCircle, NotebookText, User, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Single source of truth for the player/parent app navigation. Both the mobile
 * floating bottom tab bar and the desktop side rails render from this array so
 * the two layouts can never drift. `kind: "notifications"` is the announcements
 * bell (no route of its own); every other item is a route link.
 *
 * Order matters: the desktop rails split this list down the middle —
 * LEFT = Home / Squad / Play, RIGHT = Chat / Notifications / Me. The mobile
 * bottom bar shows the five route links only (the bell lives in the header).
 */
export type ParentNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  kind: "link" | "notifications";
  /** Present for `kind: "link"`; the notifications item has no route. */
  href?: string;
  /** Desktop side rails only — kept off the space-constrained mobile bottom bar. */
  railOnly?: boolean;
};

export const PARENT_NAV_ITEMS: ParentNavItem[] = [
  { id: "home", label: "Home", icon: Home, kind: "link", href: "/dashboard/parent" },
  { id: "squad", label: "Squad", icon: Users, kind: "link", href: "/squad" },
  { id: "play", label: "Play", icon: CalendarDays, kind: "link", href: "/schedule" },
  { id: "chat", label: "Chat", icon: MessageCircle, kind: "link", href: "/chat" },
  { id: "notes", label: "Notes", icon: NotebookText, kind: "link", href: "/coach-notes", railOnly: true },
  { id: "notifications", label: "Notifications", icon: Bell, kind: "notifications" },
  { id: "me", label: "Me", icon: User, kind: "link", href: "/me" },
];

/** Route links for the mobile bottom tab bar (bell + rail-only items excluded). */
export const PARENT_NAV_TABS = PARENT_NAV_ITEMS.filter(
  (item): item is ParentNavItem & { href: string } => item.kind === "link" && !item.railOnly,
);

/** Shared button geometry/typography for both the bottom bar and the rails. */
export const NAV_BUTTON_BASE =
  "flex w-16 flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors";
export const NAV_BUTTON_ACTIVE = "bg-primary text-primary-foreground";
export const NAV_BUTTON_INACTIVE = "text-muted-foreground hover:text-foreground";

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/parent") return pathname === "/dashboard/parent";
  return pathname === href || pathname.startsWith(`${href}/`);
}
