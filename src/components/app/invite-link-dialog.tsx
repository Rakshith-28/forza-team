"use client";

import { useState } from "react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Reusable invite-link dialog. Shows a ready-to-share accept URL with a Copy
 * button — used after creating an invite (email delivery isn't guaranteed yet)
 * and when regenerating a link for an existing pending invite. `refreshed` flags
 * the existing-invite case: generating the link rotates the token, so any
 * previously shared link stops working.
 */
export function InviteLinkDialog({
  url,
  open,
  onOpenChange,
  refreshed = false,
}: {
  url: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refreshed?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite link</DialogTitle>
          <DialogDescription>
            Share this link with the invitee — they set a password and sign in to the right role.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={url ?? ""}
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!url}
              onClick={async () => {
                if (!url) return;
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* clipboard blocked — the field is selectable for manual copy */
                }
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {refreshed ? (
            <p className="text-xs text-muted-foreground">
              This refreshes the invite — any link shared earlier no longer works.
            </p>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
