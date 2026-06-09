import type { ReactNode } from "react";

import { PageHeader } from "./page-header";

/**
 * Two-pane CRUD layout: the existing items list on the left, an "add new" form
 * docked on the right (sticky on large screens). On small screens the panes
 * stack — list first, then the form. Used across the create surfaces (seasons,
 * teams, players, coaches, events, clubs) for a consistent, uncluttered shell.
 */
export function TwoPane({
  title,
  description,
  actions,
  formTitle,
  formDescription,
  form,
  wide = false,
  children,
}: {
  title: string;
  description?: string;
  /** Optional header-right slot (e.g. filters or secondary actions). */
  actions?: ReactNode;
  formTitle: string;
  formDescription?: string;
  /** The "add new" form rendered in the right pane. */
  form: ReactNode;
  /** Widen the shell (max-w-6xl) for list panes that hold a wide data table. */
  wide?: boolean;
  /** The existing-items list rendered in the left pane. */
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
      <PageHeader title={title} description={description} actions={actions} />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">{children}</div>

        <aside className="lg:sticky lg:top-20">
          <div data-glass className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b px-4 py-3">
              <h2 className="font-sport text-base font-bold text-foreground">{formTitle}</h2>
              {formDescription ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{formDescription}</p>
              ) : null}
            </div>
            <div className="p-4">{form}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
