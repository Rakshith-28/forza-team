import { randomUUID } from "node:crypto";

import type { AuthContext } from "@/lib/rbac";

/**
 * Integration-test helpers. Suites are gated on TEST_DATABASE_URL: absent ⇒
 * `INTEGRATION` is false and `describe.skipIf(!INTEGRATION)` skips them (green
 * no-op). When present, they run against that ISOLATED database (migrations
 * applied) — never production.
 *
 * Safety guard: if TEST_DATABASE_URL is set but points at the same database as
 * the app's DATABASE_URL / DIRECT_URL (i.e. production/main), we throw at import
 * so the suite fails fast instead of mutating real data. Integration tests
 * create + tear down fixtures, so they must only ever touch a throwaway DB.
 */

/** Normalize a Postgres URL to host:port/db (ignoring creds/query and the pooler suffix) for comparison. */
function dbIdentity(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/-pooler\./, "."); // pooled vs direct = same DB
    return `${host}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return url;
  }
}

function assertIsolatedTestDb(): boolean {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) return false;
  const test = dbIdentity(testUrl);
  // PROD_* are the real app URLs captured by vitest.integration.config.ts before
  // it overrides DATABASE_URL with the test URL.
  const prod = [dbIdentity(process.env.PROD_DATABASE_URL), dbIdentity(process.env.PROD_DIRECT_URL)].filter(Boolean);
  if (test && prod.includes(test)) {
    throw new Error(
      `Refusing to run integration tests: TEST_DATABASE_URL points at the app database (${test}). ` +
        `Use an ISOLATED test DB (a Neon test branch or local Postgres) — never production.`,
    );
  }
  return true;
}

export const INTEGRATION = assertIsolatedTestDb();

/** A fresh club id namespace per run so parallel runs / leftovers don't collide. */
export function uid(): string {
  return randomUUID();
}

export function adminCtx(clubId: string): AuthContext {
  return {
    userId: uid(),
    role: "CLUB_ADMIN",
    activeClubId: clubId,
    coachTeamIds: [],
    coachTeamPlayerIds: [],
    linkedPlayerIds: [],
    childTeamIds: [],
  };
}

export function coachCtx(clubId: string, teamIds: string[], playerIds: string[]): AuthContext {
  return {
    userId: uid(),
    role: "COACH",
    activeClubId: clubId,
    coachTeamIds: teamIds,
    coachTeamPlayerIds: playerIds,
    linkedPlayerIds: [],
    childTeamIds: [],
  };
}

export function parentCtx(clubId: string, playerIds: string[], teamIds: string[]): AuthContext {
  return {
    userId: uid(),
    role: "PARENT",
    activeClubId: clubId,
    coachTeamIds: [],
    coachTeamPlayerIds: [],
    linkedPlayerIds: playerIds,
    childTeamIds: teamIds,
  };
}
