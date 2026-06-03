import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guards";
import { listClubs } from "@/modules/clubs/service";

import { ClubRow, CreateClubForm, type ClubView } from "./club-forms";

export default async function ClubsPage() {
  const ctx = await requireRole("MASTER_ADMIN");
  const clubs = await listClubs(ctx);
  const views: ClubView[] = clubs.map((c) => ({
    id: c.id,
    name: c.name,
    shortCode: c.shortCode,
    status: c.status,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl uppercase tracking-tight text-foreground">Clubs</h1>
      <p className="mt-1 text-muted-foreground">Every club on the platform.</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-sport text-base">New club</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateClubForm />
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        {views.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No clubs yet. Create the first one above.
          </p>
        ) : (
          views.map((c) => <ClubRow key={c.id} club={c} />)
        )}
      </div>
    </div>
  );
}
