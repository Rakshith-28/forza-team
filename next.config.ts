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
  // Router Cache reuse on client-side navigation. Our pages are dynamic (they
  // read the session cookie via the auth guards), and Next defaults
  // `staleTimes.dynamic` to 0 — so every sidebar tab switch re-runs the server
  // fetch and flashes the loading.tsx fallback, even for a tab visited seconds
  // ago. Giving dynamic routes a 60s reuse window lets a revisited tab render
  // instantly from cache with no blank flash; Server Action `revalidatePath`
  // calls still invalidate the cache after mutations, so data stays correct.
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
};

export default nextConfig;
