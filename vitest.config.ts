import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Dummy values so server modules that read env at import (e.g. the Prisma
    // singleton) load without a real database. No connection is made in tests.
    env: {
      DATABASE_URL: "postgresql://user:pass@localhost:5432/forza_test",
      DIRECT_URL: "postgresql://user:pass@localhost:5432/forza_test",
      AUTH_SECRET: "test-secret-at-least-32-characters-long-xx",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
