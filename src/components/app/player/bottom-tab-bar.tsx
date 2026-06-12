"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  NAV_BUTTON_ACTIVE,
  NAV_BUTTON_BASE,
  NAV_BUTTON_INACTIVE,
  PLAYER_NAV_TABS,
  isNavItemActive,
} from "./nav-items";

/**
 * Floating bottom tab bar for the player app (Home / Squad / Play / Chat
 * / Me). Mobile-first; the active tab is derived from the current path. Styling
 * (border width, shadow) comes from the active theme via `.app-tabbar`. Hidden
 * at `lg` and above, where the side rails take over (see `side-rails.tsx`).
 */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <ul className="app-tabbar pointer-events-auto flex items-center gap-1 px-2 py-1.5">
        {PLAYER_NAV_TABS.map((t) => {
          const active = isNavItemActive(pathname, t.href);
          const Icon = t.icon;
          return (
            <li key={t.id}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`${NAV_BUTTON_BASE} ${active ? NAV_BUTTON_ACTIVE : NAV_BUTTON_INACTIVE}`}
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
