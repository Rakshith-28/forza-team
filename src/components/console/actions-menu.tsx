"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ActionItem {
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** Native tooltip — used to explain why a disabled action (e.g. Impersonate) is unavailable. */
  title?: string;
  destructive?: boolean;
}

/**
 * CONSOLE row actions: a compact "⋯" trigger opening a small menu. Built without
 * an extra dependency (a click-away backdrop + local state). Stops propagation
 * so using it inside a clickable table row doesn't also open the row drawer.
 */
export function ActionsMenu({ items, label = "Actions" }: { items: ActionItem[]; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 min-w-44 overflow-hidden rounded-lg border bg-popover py-1 shadow-md"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                title={item.title}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={cn(
                  "block w-full px-3 py-1.5 text-left text-sm transition-colors",
                  item.disabled
                    ? "cursor-not-allowed text-muted-foreground/50"
                    : item.destructive
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-foreground hover:bg-secondary",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
