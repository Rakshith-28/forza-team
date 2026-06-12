"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadPlayerPhotoAction } from "@/modules/files/actions";
import { INITIAL_STATE } from "@/modules/files/action-state";

/**
 * Player-photo uploader. Used by the admin/coach player detail page and the
 * player child-profile page; scope is enforced in the files service
 * (player → own child only via the Phase 3 whitelist permission).
 */
export function PhotoUpload({ playerId }: { playerId: string }) {
  const [state, action, pending] = useActionState(uploadPlayerPhotoAction, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="playerId" value={playerId} />
      <Input
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp"
        required
        aria-label="Player photo"
        className="file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Uploading…" : "Upload photo"}
      </Button>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary" role="status">Photo updated.</p> : null}
    </form>
  );
}
