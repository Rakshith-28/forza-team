import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/lib/env";
import { Prisma, PrismaClient } from "@/db/generated/client";

/**
 * Transient "couldn't connect" failures — chiefly Neon's scale-to-zero
 * cold-start, where the first query after the DB sleeps can't reach the server.
 * The query never executed, so retrying is safe (including writes).
 */
function isConnectFailure(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P1001") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /can't reach database server|DatabaseNotReachable/i.test(msg);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Prisma client singleton.
 *
 * Prisma 7 connects through a driver adapter (no Rust engine). We use the
 * `pg` adapter over Neon's pooled connection string (DATABASE_URL).
 *
 * In dev, Next.js hot-reload re-evaluates modules, which would otherwise spawn
 * a new client (and connection pool) on every change. Caching on `globalThis`
 * prevents that. In production a single module instance is used.
 *
 * IMPORTANT: do not query through this client directly from routes. All
 * tenant-owned reads/writes go through the module data-access layer, which
 * enforces `clubId` scoping and player-safe projections (see
 * @docs/BUILD_PLAN.md §2).
 */
function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  const client = new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
  // Retry transient connect failures (Neon scale-to-zero cold-start) a couple of
  // times with a short backoff, so the first request after the DB sleeps wakes
  // it instead of surfacing "Can't reach database server" to the user. Covers
  // every operation, including raw queries.
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        const backoffMs = [200, 600];
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            if (attempt >= backoffMs.length || !isConnectFailure(err)) throw err;
            await sleep(backoffMs[attempt]);
          }
        }
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// The retry wrapper ($extends) returns a structurally-extended client; expose it
// as the base PrismaClient type so consumers (and transaction clients) are
// unchanged — the retry behaviour is purely a runtime concern.
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (createPrismaClient() as unknown as PrismaClient);

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
