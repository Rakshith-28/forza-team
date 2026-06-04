"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, MessageCircle, User, Users } from "lucide-react";

/**
 * Floating bottom tab bar for the player/parent app (Home / Squad / Play / Chat
 * / Me). Mobile-first; the active tab is derived from the current path. Styling
 * (border width, shadow) comes from the active theme via `.app-tabbar`.
 */
const TABS = [
  { href: "/dashboard/parent", label: "Home", icon: Home },
  { href: "/squad", label: "Squad", icon: Users },
  { href: "/schedule", label: "Play", icon: CalendarDays },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/me", label: "Me", icon: User },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/parent") return pathname === "/dashboard/parent";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul className="app-tabbar pointer-events-auto flex items-center gap-1 px-2 py-1.5">
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex w-16 flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
