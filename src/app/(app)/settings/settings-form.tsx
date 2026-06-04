"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { updateClubSettingsAction } from "@/modules/clubs/actions";
import { INITIAL_STATE } from "@/modules/clubs/action-state";

export interface ClubSettingsData {
  showPlayerPhotosToParents: boolean;
  allowParentChildEvaluationView: boolean;
  attendanceTrackingEnabled: boolean;
  allowCoachInviteParents: boolean;
}

const TOGGLES: { name: keyof ClubSettingsData; label: string; help: string }[] = [
  {
    name: "showPlayerPhotosToParents",
    label: "Show player photos to parents",
    help: "When on, parents see teammate photos in the safe roster view.",
  },
  {
    name: "allowParentChildEvaluationView",
    label: "Share evaluations with parents",
    help: "When on, parents can see their own child's evaluation summary (never coach-only notes).",
  },
  {
    name: "attendanceTrackingEnabled",
    label: "Attendance tracking",
    help: "Enables recording attendance for events.",
  },
  {
    name: "allowCoachInviteParents",
    label: "Coaches can invite & link parents",
    help: "When on, coaches can add players and invite/link their parents for assigned teams. Club Admins always can.",
  },
];

export function ClubSettingsForm({ settings }: { settings: ClubSettingsData }) {
  const [state, action, pending] = useActionState(updateClubSettingsAction, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-col gap-5">
      {TOGGLES.map((t) => (
        <label key={t.name} className="flex items-start gap-3">
          <input
            type="checkbox"
            name={t.name}
            defaultChecked={settings[t.name]}
            className="mt-1 size-4"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">{t.label}</span>
            <span className="block text-xs text-muted-foreground">{t.help}</span>
          </span>
        </label>
      ))}
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary" role="status">Settings saved.</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
