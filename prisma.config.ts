import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer auto-loads .env. Load it ourselves when the file is
// present; in CI the values come from real environment variables.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // No .env file (e.g. CI) — rely on the ambient environment.
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    // CLI commands (migrate, introspect) use the direct, non-pooled URL.
    url: process.env.DIRECT_URL,
  },
});
