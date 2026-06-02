import { NextResponse } from "next/server";

import { prisma } from "@/db/client";
import { logger } from "@/lib/logger";

// Always run fresh; never cache a health probe.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness + DB readiness probe.
 *
 * Returns 200 when the app can reach Postgres, 503 otherwise. Used by uptime
 * monitors and as the Phase 0 "connects to DB" exit check. Intentionally
 * unauthenticated and leaks no schema details.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        db: "up",
        latencyMs: Date.now() - startedAt,
        time: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("health check failed", { error });
    return NextResponse.json(
      {
        status: "degraded",
        db: "down",
        latencyMs: Date.now() - startedAt,
        time: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
