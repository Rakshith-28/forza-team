import { cn } from "@/lib/utils";

/**
 * Hollow, recessed scroll panel — the shared "list container" look from the
 * coach-portal player roster: a transparent rounded frame with a muted border
 * and an inset shadow, scrolling its bordered item cards internally.
 *
 * `maxHeightClass` controls how many rows are visible before it scrolls;
 * `gapClass` overrides the default row spacing.
 */
export function ScrollPanel({
  maxHeightClass = "max-h-96",
  gapClass = "gap-2.5",
  children,
}: {
  maxHeightClass?: string;
  gapClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-muted-foreground/25 bg-transparent shadow-[inset_0_2px_5px_rgba(0,0,0,0.12),inset_0_-1px_2px_rgba(255,255,255,0.6)]">
      <div className={cn("overflow-y-auto p-3 sm:p-4", maxHeightClass)}>
        <div className={cn("flex flex-col", gapClass)}>{children}</div>
      </div>
    </div>
  );
}
