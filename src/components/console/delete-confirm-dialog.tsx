"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";

/**
 * Typed-name confirmation for HARD, permanent deletions (deletion-spec). Built on
 * the same Radix Dialog primitive as the CONSOLE drawer, but centered. The confirm
 * button stays disabled until the operator types the exact `confirmPhrase`, then
 * submits a thin server action with `fields` as hidden inputs.
 *
 * This is a UI safety gate; the authoritative checks (permission + club scope) and
 * the audit snapshot live in the service layer.
 */
export function DeleteConfirmDialog({
  triggerLabel,
  title,
  description,
  confirmPhrase,
  action,
  fields,
  confirmLabel = "Delete permanently",
  triggerClassName,
}: {
  triggerLabel: string;
  title: string;
  description: React.ReactNode;
  /** The operator must type this exactly to enable the confirm button. */
  confirmPhrase: string;
  /** Thin server action invoked on confirm. */
  action: (formData: FormData) => void | Promise<void>;
  /** Hidden inputs submitted with the action (e.g. the entity id). */
  fields: Record<string, string>;
  confirmLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const match = typed.trim() === confirmPhrase.trim();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setTyped(""); // reset the gate whenever the dialog closes
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger
        className={cn(
          "rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/40",
          triggerClassName,
        )}
      >
        {triggerLabel}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border bg-card p-6 shadow-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out data-[state=open]:zoom-in-95",
          )}
        >
          <div className="min-w-0">
            <DialogPrimitive.Title className="font-sport text-lg font-bold tracking-tight text-foreground break-words">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description asChild>
              <div className="mt-2 text-sm text-muted-foreground break-words">{description}</div>
            </DialogPrimitive.Description>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="dc-confirm" className="text-sm text-foreground break-words">
              Type <span className="font-semibold">{confirmPhrase}</span> to confirm
            </label>
            <input
              id="dc-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <DialogPrimitive.Close className="rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary">
              Cancel
            </DialogPrimitive.Close>
            <form action={action}>
              {Object.entries(fields).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <button
                type="submit"
                disabled={!match}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmLabel}
              </button>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
