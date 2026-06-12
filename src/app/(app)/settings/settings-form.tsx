"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { updateClubSettingsAction } from "@/modules/clubs/actions";
import { INITIAL_STATE } from "@/modules/clubs/action-state";

export interface ClubSettingsData {
  showPlayerPhotosToPlayers: boolean;
  allowPlayerEvaluationView: boolean;
  attendanceTrackingEnabled: boolean;
  allowCoachInvitePlayers: boolean;
}

const TOGGLES: { name: keyof ClubSettingsData; label: string; help: string }[] = [
  {
    name: "showPlayerPhotosToPlayers",
    label: "Show player photos to players",
    help: "When on, players see teammate photos in the safe roster view.",
  },
  {
    name: "allowPlayerEvaluationView",
    label: "Share evaluations with players",
    help: "When on, players can see their own child's evaluation summary (never coach-only notes).",
  },
  {
    name: "attendanceTrackingEnabled",
    label: "Attendance tracking",
    help: "Enables recording attendance for events.",
  },
  {
    name: "allowCoachInvitePlayers",
    label: "Coaches can invite & link players",
    help: "When on, coaches can add players and invite/link their players for assigned teams. Club Managers always can.",
  },
];

export function ClubSettingsForm({ settings }: { settings: ClubSettingsData }) {
  const [state, action, pending] = useActionState(updateClubSettingsAction, INITIAL_STATE);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {TOGGLES.map((t) => (
          <ToggleSwitch key={t.name} name={t.name} label={t.label} help={t.help} defaultChecked={settings[t.name]} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-primary" role="status">Settings saved.</p> : null}
      </div>
    </form>
  );
}
