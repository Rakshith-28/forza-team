import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface DashboardCard {
  title: string;
  description: string;
}

/**
 * Placeholder role dashboard (Phase 1). Confirms the signed-in user landed on
 * the role-correct surface; the real per-role data lands in Phase 6.
 */
export function DashboardPlaceholder({
  title,
  subtitle,
  cards,
}: {
  title: string;
  subtitle: string;
  cards: DashboardCard[];
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-muted-foreground">{subtitle}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle className="text-base">{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Feature pages arrive in later phases. This dashboard confirms your role and scope are
        wired correctly.
      </p>
    </div>
  );
}
