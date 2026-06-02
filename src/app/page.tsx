import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-24">
      <main className="flex w-full max-w-2xl flex-col items-start gap-6">
        <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          Phase 0 · Foundation
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Forza Team
        </h1>
        <p className="max-w-prose text-lg text-muted-foreground">
          Multi-tenant soccer club management. The foundation is in place —
          Next.js, Prisma 7 on Neon, validated config, a themed component
          system, and a database health check.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a href="/api/health">Check health</a>
          </Button>
          <Button asChild variant="outline">
            <a
              href="https://github.com/Rakshith-28/forza-team"
              target="_blank"
              rel="noopener noreferrer"
            >
              Repository
            </a>
          </Button>
        </div>
      </main>
    </div>
  );
}
