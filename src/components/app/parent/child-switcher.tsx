import { setActiveChildAction } from "@/app/(app)/dashboard/parent/child-actions";
import { cn } from "@/lib/utils";

/**
 * Parent active-child switcher: a row of themed pills letting a parent of more
 * than one child focus the portal (dashboard, etc.) on one of them. Renders
 * nothing for single-child parents. The selection persists via cookie, so the
 * whole parent portal follows it.
 */
export function ChildSwitcher({
  kids,
  activeId,
}: {
  kids: { id: string; displayName: string }[];
  activeId: string;
}) {
  if (kids.length < 2) return null;

  return (
    <form action={setActiveChildAction} className="-mx-1 flex gap-2 overflow-x-auto px-1">
      {kids.map((c) => (
        <button
          key={c.id}
          type="submit"
          name="childId"
          value={c.id}
          aria-current={c.id === activeId ? "true" : undefined}
          className={cn(
            "app-pill shrink-0 px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            c.id === activeId ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
          )}
        >
          {c.displayName}
        </button>
      ))}
    </form>
  );
}
