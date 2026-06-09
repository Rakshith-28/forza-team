import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * CONSOLE filter bar — a GET `<form>` so filters live in the URL (shareable,
 * server-rendered, no client state). Compose with the field helpers below.
 * Submitting drops the `page` param, returning to page 1.
 */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form
      method="get"
      data-glass
      className={cn("flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 shadow-sm", className)}
    >
      {children}
      <Button type="submit" variant="outline">
        Filter
      </Button>
    </form>
  );
}

export function FilterText({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <Input id={`f-${name}`} name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
    </div>
  );
}

export function FilterSelect({
  name,
  label,
  defaultValue,
  allLabel = "All",
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  allLabel?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <Select id={`f-${name}`} name={name} defaultValue={defaultValue ?? ""} className="min-w-40">
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function buildHref(base: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v != null && v !== "" && k !== "page") params.set(k, v);
  }
  params.set("page", String(page));
  return `?${params.toString()}`;
}

/**
 * URL-driven pagination. `params` is the current searchParams (its `page` is
 * ignored); prev/next links preserve the active filters.
 */
export function Pagination({
  page,
  pageSize,
  total,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(params, page - 1)}>Previous</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}
        <span className="px-1">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(params, page + 1)}>Next</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
