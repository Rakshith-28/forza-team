"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { uploadClubDocumentAction, uploadTeamDocumentAction } from "@/modules/files/actions";
import { INITIAL_STATE } from "@/modules/files/action-state";

const ACCEPT = "application/pdf,text/plain,text/csv,image/jpeg,image/png,image/webp";

export function UploadDocumentForm() {
  const [state, action, pending] = useActionState(uploadClubDocumentAction, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        type="file"
        name="file"
        accept={ACCEPT}
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

export interface TeamOption {
  id: string;
  name: string;
}

export function UploadTeamDocumentForm({ teams }: { teams: TeamOption[] }) {
  const [state, action, pending] = useActionState(uploadTeamDocumentAction, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="td-team" className="text-sm font-medium">
          Team
        </label>
        <Select id="td-team" name="teamId" defaultValue="" required>
          <option value="" disabled>
            Select a team…
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <Input
        type="file"
        name="file"
        accept={ACCEPT}
        required
        aria-label="Team document"
        className="file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {state.error ? <p className="text-sm text-destructive sm:basis-full" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary sm:basis-full" role="status">Uploaded.</p> : null}
    </form>
  );
}
