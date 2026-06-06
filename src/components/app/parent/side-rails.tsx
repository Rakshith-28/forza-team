"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AnnouncementsBell } from "@/components/app/announcements-bell";
import { cn } from "@/lib/utils";

import {
  NAV_BUTTON_ACTIVE,
  NAV_BUTTON_BASE,
  NAV_BUTTON_INACTIVE,
  PARENT_NAV_ITEMS,
  isNavItemActive,
  type ParentNavItem,
} from "./nav-items";

/**
 * Desktop (`lg`+) navigation: two vertical rails docked in the left and right
 * gutters, fixed and vertically centered so they stay put while the page
 * scrolls. They render from the same `PARENT_NAV_ITEMS` array as the mobile
 * bottom tab bar — split down the middle: LEFT = Home / Squad / Play,
 * RIGHT = Chat / Notifications / Me. Buttons reuse the exact bottom-bar styling.
 * Hidden below `lg`, where the floating bottom bar takes over.
 */
const LEFT_ITEMS = PARENT_NAV_ITEMS.slice(0, 3);
const RIGHT_ITEMS = PARENT_NAV_ITEMS.slice(3);

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function RailItem({
  item,
  pathname,
  unreadAnnouncements,
}: {
  item: ParentNavItem;
  pathname: string;
  unreadAnnouncements: number;
}) {
  if (item.kind === "notifications") {
    return <AnnouncementsBell variant="tab" label={item.label} initialCount={unreadAnnouncements} />;
  }

  const href = item.href!;
  const active = isNavItemActive(pathname, href);
  const Icon = item.icon;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={cn(NAV_BUTTON_BASE, FOCUS_RING, active ? NAV_BUTTON_ACTIVE : NAV_BUTTON_INACTIVE)}
    >
      <Icon className="size-5" aria-hidden />
      {item.label}
    </Link>
  );
}

export function SideRails({ unreadAnnouncements = 0 }: { unreadAnnouncements?: number }) {
  const pathname = usePathname();

  const rail = (items: ParentNavItem[]) =>
    items.map((item) => (
      <li key={item.id}>
        <RailItem item={item} pathname={pathname} unreadAnnouncements={unreadAnnouncements} />
      </li>
    ));

  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="app-tabbar fixed left-4 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 px-1.5 py-2">
        {rail(LEFT_ITEMS)}
      </ul>
      <ul className="app-tabbar fixed right-4 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 px-1.5 py-2">
        {rail(RIGHT_ITEMS)}
      </ul>
    </nav>
  );
}
