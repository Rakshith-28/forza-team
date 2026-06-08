"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronDown, LogOut, Settings } from "lucide-react";

import { clearActiveIdentityAction, setActiveIdentityAction } from "@/app/(app)/identity-actions";
import { signOut } from "@/lib/auth-client";
import type { Identity } from "@/modules/identity/identities";
import { cn } from "@/lib/utils";

/**
 * Navbar account dropdown: an avatar button that opens a menu with the user's
 * personal "Profile settings" (→ /account) and "Sign out". Available to every
 * role. Club/system settings stay in the sidebar (admins only). Uses the
 * codebase's custom dropdown pattern (state + backdrop + absolute menu) rather
 * than a Radix dependency that isn't installed.
 *
 * Multi-identity users also get a compact "Switch role" section between the user
 * details and "Profile settings" — the everywhere-available counterpart to the
 * full-width {@link IdentitySwitcher} row, which only shows on the dashboard.
 */
export function AccountMenu({
  name,
  email,
  initial,
  roleLabel,
  profileHref = "/account",
  identities = [],
  current = null,
}: {
  name: string;
  email: string;
  initial: string;
  roleLabel: string;
  /** Personal profile/settings destination (parents use /me, console roles use /account). */
  profileHref?: string;
  /** Every identity the user holds; ≥2 enables the inline role switcher. */
  identities?: Identity[];
  /** The identity currently being acted as (for the active checkmark). */
  current?: Identity | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const canSwitch = identities.length >= 2;

  function closeMenu() {
    setOpen(false);
    setSwitchOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSignOut() {
    setPending(true);
    await clearActiveIdentityAction();
    await signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => (open ? closeMenu() : setOpen(true))}
        className="app-pill flex size-9 items-center justify-center bg-primary text-sm font-bold text-primary-foreground shadow-(--app-shadow) ring-2 ring-transparent transition-all hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-primary"
      >
        {initial}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={closeMenu}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border bg-card p-1.5 shadow-xl"
          >
            <div className="border-b px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-foreground">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>

              {/* The current role chip. For multi-identity users it doubles as a
                  dropdown trigger (chevron) that reveals the other roles inline;
                  picking one switches profile. Single-identity users see a static
                  chip with no chevron. */}
              {canSwitch ? (
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={switchOpen}
                  aria-label="Switch role"
                  onClick={() => setSwitchOpen((o) => !o)}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-2 pr-1.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground transition-colors hover:bg-secondary/70"
                >
                  {roleLabel}
                  <ChevronDown
                    className={cn("size-3 transition-transform", switchOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
              ) : (
                <span className="mt-1.5 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
                  {roleLabel}
                </span>
              )}

              {canSwitch && switchOpen ? (
                <div role="menu" className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
                  {identities.map((i) => {
                    const active = i.key === current?.key;
                    const sub = [i.roleLabel, i.clubName].filter(Boolean).join(" · ");
                    return (
                      <form key={i.key} action={setActiveIdentityAction}>
                        <input type="hidden" name="identity" value={i.key} />
                        <button
                          type="submit"
                          role="menuitem"
                          aria-current={active ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                            active ? "bg-secondary" : "hover:bg-secondary",
                          )}
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
                            {i.roleLabel.trim().slice(0, 1).toUpperCase() || "•"}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col leading-tight">
                            <span className="truncate text-xs font-semibold text-foreground">{i.contextLabel}</span>
                            <span className="truncate text-[10px] text-muted-foreground">{sub}</span>
                          </span>
                          {active ? <Check className="size-3.5 shrink-0 text-primary" aria-hidden /> : null}
                        </button>
                      </form>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <Link
              href={profileHref}
              role="menuitem"
              onClick={closeMenu}
              className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
            >
              <Settings className="size-4 text-muted-foreground" aria-hidden />
              Profile settings
            </Link>

            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
            >
              <LogOut className="size-4" aria-hidden />
              {pending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
