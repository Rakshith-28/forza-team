"use client";

import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Extra classes for both the header and body cells (alignment/width). */
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Show skeleton rows instead of data. */
  loading?: boolean;
  /** Render an error banner in place of the body. */
  error?: string | null;
  emptyMessage?: string;
  className?: string;
  /** Caps the body height so long tables scroll inside the card instead of the page. */
  maxHeightClass?: string;
}

/**
 * CONSOLE data table — a thin, formal table with built-in loading, empty, and
 * error states. Generic over the row type; callers (client components) supply
 * column cell renderers, an optional row-click handler, and a stable row key.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  loading = false,
  error = null,
  emptyMessage = "Nothing to show yet.",
  className,
  maxHeightClass = "max-h-[calc(100vh-16rem)]",
}: DataTableProps<T>) {
  return (
    <div data-glass className={cn("overflow-hidden rounded-xl border bg-card shadow-sm", className)}>
      {/* Scrolls both ways inside the card: long tables scroll vertically (the
          header stays pinned), and narrow phones scroll the row horizontally
          instead of squishing columns. */}
      <div className={cn("overflow-auto", maxHeightClass)}>
        <table className="w-full min-w-2xl border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b bg-secondary">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-destructive" role="alert">
                  {error}
                </td>
              </tr>
            ) : loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <span className="block h-4 w-24 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b last:border-0",
                    onRowClick && "cursor-pointer transition-colors hover:bg-secondary/50",
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
