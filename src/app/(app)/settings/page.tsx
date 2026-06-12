import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { getClubSettings } from "@/modules/clubs/service";

import { ClubSettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const ctx = await requireRole("MASTER_ADMIN", "CLUB_ADMIN");
  if (!ctx.activeClubId) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-sport text-xl font-bold">No active club</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account isn&apos;t scoped to a club yet.</p>
      </div>
    );
  }

  const settings = await getClubSettings(ctx, ctx.activeClubId);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Settings</h1>
      <p className="mt-1 text-muted-foreground">Privacy and feature controls for your club.</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">Club preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <ClubSettingsForm
            settings={{
              showPlayerPhotosToPlayers: settings.showPlayerPhotosToPlayers,
              allowPlayerEvaluationView: settings.allowPlayerEvaluationView,
              attendanceTrackingEnabled: settings.attendanceTrackingEnabled,
              allowCoachInvitePlayers: settings.allowCoachInvitePlayers,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
