import type { ReactNode } from "react";

/**
 * Shared "Team Roster" list shell: a hollow, inset-3D bordered box whose items
 * scroll internally as the list grows. Items are laid out in a small vertical
 * stack; pass compact card rows as children. Used across the console list
 * surfaces (players, seasons, teams, parents) for a consistent look.
 */
export function ListContainer({ children }: { children: ReactNode }) {
  return (
    <div
      data-glass
      className="overflow-hidden rounded-xl border border-muted-foreground/25 bg-transparent shadow-[inset_0_2px_5px_rgba(0,0,0,0.12),inset_0_-1px_2px_rgba(255,255,255,0.6)]"
    >
      <div className="max-h-[calc(100vh-15rem)] overflow-y-auto p-3 sm:p-4">
        <div className="flex flex-col gap-2.5">{children}</div>
      </div>
    </div>
  );
}
