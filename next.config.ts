import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without it, Turbopack can infer
  // the wrong root when a stray lockfile exists in a parent directory.
  turbopack: {
    root: __dirname,
  },
  // Keep server-only packages external (required at runtime, not bundled).
  // Better Auth statically references its built-in Kysely adapter + optional
  // DB drivers, which Turbopack cannot bundle cleanly; externalizing them
  // (and the Prisma driver) avoids that.
  serverExternalPackages: ["better-auth", "kysely", "pg", "@prisma/adapter-pg"],
};

export default nextConfig;
