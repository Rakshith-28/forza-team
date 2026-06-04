import { cn } from "@/lib/utils";

function monogram(name: string, fallback?: string): string {
  const source = name.trim() || fallback?.trim() || "?";
  return (source[0] ?? "?").toUpperCase();
}

/**
 * CONSOLE identity cell: a monogram (or logo/avatar when an image is given)
 * beside a primary name and optional muted subtext. Used for club rows, coaches,
 * and users so avatars read consistently across every table.
 */
export function PersonCell({
  name,
  subtext,
  imageUrl,
  fallback,
  className,
}: {
  name: string;
  subtext?: string | null;
  imageUrl?: string | null;
  fallback?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos are arbitrary remote URLs; matches the app's existing <img> usage (no images.remotePatterns configured).
        <img src={imageUrl} alt="" className="size-9 shrink-0 rounded-full border object-cover" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
          {monogram(name, fallback)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{name}</p>
        {subtext ? <p className="truncate text-xs text-muted-foreground">{subtext}</p> : null}
      </div>
    </div>
  );
}
