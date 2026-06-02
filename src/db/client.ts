import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/lib/env";
import { PrismaClient } from "@/db/generated/client";

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
 * enforces `clubId` scoping and parent-safe projections (see
 * @docs/BUILD_PLAN.md §2).
 */
function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma: PrismaClientSingleton =
  globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
