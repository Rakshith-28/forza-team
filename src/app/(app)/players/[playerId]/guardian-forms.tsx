"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  inviteGuardianAction,
  linkGuardianAction,
  searchGuardiansAction,
} from "@/modules/roster/actions";
import { INITIAL_STATE } from "@/modules/roster/action-state";
import { RELATIONSHIP_LABELS, RELATIONSHIP_TYPES } from "@/modules/roster/schemas";

function RelationshipFields() {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="relationshipType">Relationship</Label>
        <Select id="relationshipType" name="relationshipType" defaultValue="GUARDIAN">
          {RELATIONSHIP_TYPES.map((r) => (
            <option key={r} value={r}>
              {RELATIONSHIP_LABELS[r]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="canPickup" /> Can pick up
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="canPay" defaultChecked /> Can pay
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isPrimaryGuardian" /> Primary guardian
        </label>
      </div>
    </>
  );
}

/** Invite a (new) parent by email, tied to this player. No name fields (collected at accept). */
export function InviteGuardianForm({ playerId }: { playerId: string }) {
  const [state, action, pending] = useActionState(inviteGuardianAction, INITIAL_STATE);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // After a successful invite, clear the fields so the next parent's email can
  // be typed straight away (reset() is a DOM call, not setState — no cascade).
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const linkUrl = state.ok ? state.acceptUrl ?? null : null;

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Invite parent
      </Button>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex w-full flex-col gap-3 rounded-lg border bg-card p-3">
      <input type="hidden" name="playerId" value={playerId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="g-email">Parent email</Label>
        <Input id="g-email" name="email" type="email" placeholder="parent@example.com" required />
      </div>
      <RelationshipFields />
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-sm text-primary" role="status">
          {state.notice ?? "Invitation sent — enter another email to invite the next parent."}
        </p>
      ) : null}

      {/* Inline invite link — shown in the form (no blocking modal), so the
          email field stays editable for inviting the next parent. */}
      {linkUrl ? (
        <div className="flex flex-col gap-1.5 rounded-md border bg-secondary/30 p-2.5">
          <p className="text-xs font-medium text-foreground">Invite link — copy and share it:</p>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={linkUrl}
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(linkUrl);
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
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </form>
  );
}

interface ParentResult {
  id: string;
  name: string;
  email: string;
}

/** Link an existing club parent: search → pick → set relationship/permissions → link. */
export function LinkExistingGuardianForm({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ParentResult | null>(null);
  const [state, action, pending] = useActionState(linkGuardianAction, INITIAL_STATE);

  async function search() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      setResults(await searchGuardiansAction(query));
    } finally {
      setSearching(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Link existing parent
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="g-search">Find a parent</Label>
          <Input
            id="g-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or email (min 2 chars)"
          />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={search} disabled={searching}>
          {searching ? "…" : "Search"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      {!selected ? (
        <ul className="flex flex-col gap-1">
          {results.length === 0 ? (
            <li className="text-xs text-muted-foreground">No matches yet — search by name or email.</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  className="w-full rounded-md border bg-card p-2 text-left text-sm hover:border-primary"
                >
                  <span className="font-medium text-foreground">{r.name}</span>{" "}
                  <span className="text-muted-foreground">· {r.email}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="playerId" value={playerId} />
          <input type="hidden" name="parentId" value={selected.id} />
          <p className="text-sm">
            Linking <span className="font-medium text-foreground">{selected.name}</span>{" "}
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setSelected(null)}>
              change
            </button>
          </p>
          <RelationshipFields />
          {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-primary" role="status">Linked.</p> : null}
          <div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Linking…" : "Link parent"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
