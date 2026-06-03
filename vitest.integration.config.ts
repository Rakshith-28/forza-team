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
const testDbUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://user:pass@localhost:5432/forza_integration_unset";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests-integration/**/*.test.ts"],
    // The Prisma singleton reads these at import; point them at the test DB.
    env: {
      DATABASE_URL: testDbUrl,
      DIRECT_URL: testDbUrl,
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
