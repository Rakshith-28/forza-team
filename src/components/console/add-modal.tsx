"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

/**
 * "Add X" launcher: a labelled trigger button (e.g. "Add Player") on a section
 * heading that opens a CENTERED modal wrapping an existing create form. Reuses
 * the shared Radix Dialog (centered variant) — no new modal dependency. The
 * create actions redirect on success, so the modal needs no close-on-success
 * wiring; the invite flow keeps the modal open to surface its accept link.
 */
export function AddModal({
  label,
  title,
  description,
  children,
}: {
  /** Trigger label, e.g. "Add Player". The + icon is appended automatically. */
  label: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          {label}
          <Plus className="size-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent variant="center">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription className="mt-1">{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}
