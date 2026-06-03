"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadClubDocumentAction } from "@/modules/files/actions";
import { INITIAL_STATE } from "@/modules/files/action-state";

export function UploadDocumentForm() {
  const [state, action, pending] = useActionState(uploadClubDocumentAction, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        type="file"
        name="file"
        accept="application/pdf,text/plain,text/csv,image/jpeg,image/png,image/webp"
        required
        aria-label="Document"
        className="file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Uploading…" : "Upload document"}
      </Button>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary" role="status">Uploaded.</p> : null}
    </form>
  );
}
