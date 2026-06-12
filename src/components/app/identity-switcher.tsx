"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { setActiveIdentityAction } from "@/app/(app)/identity-actions";
import type { Identity } from "@/modules/identity/identities";
import { cn } from "@/lib/utils";

/**
 * Top-bar identity switcher: shows the identity the user is currently acting as
 * ("Coach · Mavericks FC U14 Boys", "Player · Sohaan", …) and, on click, a
 * dropdown of every other identity they hold. Selecting one submits the
 * re-validated `setActiveIdentityAction`, which sets the cookie and redirects to
 * that role's home — so the whole shell instantly follows the new identity.
 *
 * Full-width by design: it stretches to fill its content column (full screen
 * width on mobile, the content width on desktop). Single-identity users see a
 * static label (no dropdown). Uses the codebase's custom dropdown pattern
 * (state + backdrop + absolute menu), not a Radix dependency.
 *
 * Scoped to the dashboard: callers gate this prominent row to `/dashboard*`
 * routes via {@link DashboardIdentityRow}. Everywhere else the compact role
 * switcher inside the navbar account menu takes over (see {@link AccountMenu}).
 */
export function IdentitySwitcher({
  identities,
  current,
}: {
  identities: Identity[];
  current: Identity | null;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!current) return null;

  const initial = current.roleLabel.trim().slice(0, 1).toUpperCase() || "•";
  const subtitle = [current.roleLabel, current.clubName].filter(Boolean).join(" · ");

  const avatar = (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {initial}
    </span>
  );
  const labels = (
    <span className="flex min-w-0 flex-1 flex-col items-start text-left leading-tight">
      <span className="w-full truncate text-sm font-semibold text-foreground">{current.contextLabel}</span>
      <span className="w-full truncate text-[11px] text-muted-foreground">{subtitle}</span>
    </span>
  );

  // Single identity → a non-interactive, full-width context label.
  if (identities.length < 2) {
    return (
      <div
        className="flex w-full items-center justify-start gap-2.5 rounded-full border bg-card py-1.5 pl-1.5 pr-3 text-left"
        aria-label="Current identity"
      >
        {avatar}
        {labels}
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch role"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-start gap-2.5 rounded-full border bg-card py-1.5 pl-1.5 pr-3 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {avatar}
        {labels}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute left-0 right-0 z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border bg-card p-1.5 shadow-xl sm:right-auto sm:w-[22rem] sm:max-w-[90vw]"
          >
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Switch role
            </p>
            {identities.map((i) => {
              const active = i.key === current.key;
              const sub = [i.roleLabel, i.clubName].filter(Boolean).join(" · ");
              return (
                <form key={i.key} action={setActiveIdentityAction}>
                  <input type="hidden" name="identity" value={i.key} />
                  <button
                    type="submit"
                    role="menuitem"
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                      active ? "bg-secondary" : "hover:bg-secondary",
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                      {i.roleLabel.trim().slice(0, 1).toUpperCase() || "•"}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm font-semibold text-foreground">{i.contextLabel}</span>
                      <span className="truncate text-[11px] text-muted-foreground">{sub}</span>
                    </span>
                    {active ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                  </button>
                </form>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
