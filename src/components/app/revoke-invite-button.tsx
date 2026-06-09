"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";

/**
 * "Revoke" control for a pending invitation. Calls the supplied server action
 * (which sets the invite to REVOKED and revalidates the list); presentation
 * only — authorization stays in the service layer.
 */
export function RevokeInviteButton({
  invitationId,
  action,
}: {
  invitationId: string;
  action: (invitationId: string) => Promise<{ ok: boolean; error: string | null }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => startTransition(async () => { await action(invitationId); })}
      className="text-muted-foreground hover:text-destructive"
    >
      {pending ? "Revoking…" : "Revoke"}
    </Button>
  );
}
