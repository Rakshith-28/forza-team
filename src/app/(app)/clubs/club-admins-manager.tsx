"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusBadge } from "@/components/console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inviteClubAdminAction,
  loadClubAdminsAction,
  resendClubAdminInviteAction,
  revokeClubAdminInviteAction,
} from "@/modules/master/actions";
import type { ClubAdminRow } from "@/modules/master/service";

import { CopyableLink } from "./copyable-link";

interface ShareInfo {
  acceptUrl?: string;
  emailDelivered?: boolean;
  email?: string;
}

/**
 * Club Admins manager (inside the club detail drawer's Users tab). Lists active
 * + pending admins, invites new ones, and resends/revokes pending invites. When
 * email isn't configured it surfaces the accept link to copy. Self-refreshes the
 * list and calls router.refresh() so orphan badges update elsewhere.
 */
export function ClubAdminsManager({ clubId, initialAdmins }: { clubId: string; initialAdmins: ClubAdminRow[] }) {
  const router = useRouter();
  const [admins, setAdmins] = useState<ClubAdminRow[]>(initialAdmins);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [pending, startTransition] = useTransition();

  async function refresh() {
    try {
      setAdmins(await loadClubAdminsAction(clubId));
    } catch {
      /* keep the current list on a refresh hiccup */
    }
    router.refresh();
  }

  function invite() {
    if (!email.trim()) {
      setError("Enter an email to invite.");
      return;
    }
    startTransition(async () => {
      const res = await inviteClubAdminAction(clubId, { email, firstName, lastName });
      if (!res.ok) {
        setError(res.error);
        setShare(null);
        return;
      }
      setError(null);
      setShare({ acceptUrl: res.acceptUrl, emailDelivered: res.emailDelivered, email: res.email });
      setEmail("");
      setFirstName("");
      setLastName("");
      await refresh();
    });
  }

  function resend(id: string) {
    startTransition(async () => {
      const res = await resendClubAdminInviteAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setShare({ acceptUrl: res.acceptUrl, emailDelivered: res.emailDelivered });
      await refresh();
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await revokeClubAdminInviteAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setShare(null);
      await refresh();
    });
  }

  return (
    <section className="rounded-lg border bg-secondary/30 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Club admins</h3>

      {admins.length === 0 ? (
        <p className="mt-2 rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-700">
          This club has no admin yet. Invite one below so someone can run it.
        </p>
      ) : (
        <ul className="mt-2 divide-y">
          {admins.map((a) => (
            <li key={`${a.kind}-${a.id}`} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                <p className="truncate text-xs text-muted-foreground">{a.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={a.status} />
                {a.kind === "INVITE" ? (
                  <>
                    <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => resend(a.id)}>
                      Resend
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      className="text-destructive hover:text-destructive"
                      onClick={() => revoke(a.id)}
                    >
                      Revoke
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Invite form */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ca-email">Email</Label>
          <Input
            id="ca-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@club.test"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ca-first">First name</Label>
          <Input id="ca-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ca-last">Last name</Label>
          <Input id="ca-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="mt-3">
        <Button type="button" size="sm" disabled={pending} onClick={invite}>
          {pending ? "Working…" : "Invite club admin"}
        </Button>
      </div>

      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {share ? (
        <div className="mt-3 rounded-md border bg-card p-3" role="status">
          {share.emailDelivered ? (
            <p className="text-sm text-muted-foreground">
              Invitation emailed{share.email ? ` to ${share.email}` : ""}.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Email isn&apos;t configured — share this invite link:</p>
              {share.acceptUrl ? (
                <div className="mt-2">
                  <CopyableLink url={share.acceptUrl} />
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
