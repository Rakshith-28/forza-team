"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { InviteLinkDialog } from "./invite-link-dialog";

/** Result shape returned by the per-module "copy link for existing invite" actions. */
export type CopyInviteLinkResult = { ok: boolean; error: string | null; acceptUrl?: string };

/**
 * "Copy invite link" control for an existing pending invite. Calls the supplied
 * server action (which rotates the token via resendInvitation) and opens the
 * shared InviteLinkDialog with the fresh URL. The action is module-scoped so
 * authorization stays in the service layer; this component is presentation only.
 */
export function CopyInviteLinkButton({
  invitationId,
  action,
}: {
  invitationId: string;
  action: (invitationId: string) => Promise<CopyInviteLinkResult>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await action(invitationId);
            if (!res.ok || !res.acceptUrl) {
              setError(res.error ?? "Couldn't generate a link.");
              return;
            }
            setError(null);
            setUrl(res.acceptUrl);
            setOpen(true);
          })
        }
      >
        {pending ? "Working…" : "Copy invite link"}
      </Button>
      <InviteLinkDialog url={url} open={open} onOpenChange={setOpen} refreshed />
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
