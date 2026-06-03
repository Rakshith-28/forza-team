import { randomUUID } from "node:crypto";

import type { AuthContext } from "@/lib/rbac";

/**
 * Integration-test helpers. The suites are gated on TEST_DATABASE_URL — when it
 * is absent, `INTEGRATION` is false and `describe.skipIf(!INTEGRATION)` makes the
 * suites skip (green no-op). When present, the suites run against that isolated
 * database (which must have migrations applied).
 */
export const INTEGRATION = !!process.env.TEST_DATABASE_URL;

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
