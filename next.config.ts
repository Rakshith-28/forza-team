import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without it, Turbopack can infer
  // the wrong root when a stray lockfile exists in a parent directory.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
