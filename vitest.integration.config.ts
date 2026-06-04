import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * DB-backed integration tests. These run ONLY against an isolated test database
 * (never the shared dev branch): set TEST_DATABASE_URL to a local Docker
 * Postgres or an ephemeral Neon branch that has had `prisma migrate deploy` run.
 * When TEST_DATABASE_URL is unset, the suites skip themselves (see
 * tests-integration/helpers.ts) so `npm run test:integration` is a green no-op.
 *
 *   docker run -e POSTGRES_PASSWORD=pw -p 5433:5432 -d postgres:16
 *   TEST_DATABASE_URL=postgresql://postgres:pw@localhost:5433/postgres \
 *     npx prisma migrate deploy
 *   TEST_DATABASE_URL=... npm run test:integration
 */
// Load .env (if present) so we can capture the REAL app DB URLs before we
// override them — the safety guard in helpers.ts compares TEST_DATABASE_URL
// against these to refuse running against production.
try {
  process.loadEnvFile();
} catch {
  /* no .env (CI) — rely on the ambient environment */
}

const appDatabaseUrl = process.env.DATABASE_URL ?? "";
const appDirectUrl = process.env.DIRECT_URL ?? "";
const testDbUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://user:pass@localhost:5432/forza_integration_unset";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests-integration/**/*.test.ts"],
    // The Prisma singleton reads DATABASE_URL/DIRECT_URL at import; point them at
    // the test DB. PROD_* carry the real app URLs so the guard can compare.
    env: {
      DATABASE_URL: testDbUrl,
      DIRECT_URL: testDbUrl,
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      PROD_DATABASE_URL: appDatabaseUrl,
      PROD_DIRECT_URL: appDirectUrl,
      AUTH_SECRET: "test-secret-at-least-32-characters-long-xx",
    },
    // Integration tests share one DB; don't run files in parallel.
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
