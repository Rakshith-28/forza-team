import { cn } from "@/lib/utils";

/**
 * CONSOLE page header: the platform's display-font title with optional muted
 * description and a right-aligned actions slot. Replaces the repeated
 * `h1 + p` markup at the top of each admin page.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
