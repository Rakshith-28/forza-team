import "server-only";

import { cache } from "react";

import { prisma } from "@/db/client";
import { isRole, pickActiveRole, type Role } from "@/lib/rbac/roles";
import type { AuthContext } from "@/lib/rbac/scope";

/**
 * Builds the request's {@link AuthContext} from our own authorization tables
 * (`user_role_assignments`, `team_coaches`, `parents`/`player_parent_links`,
 * `player_team_memberships`). This is the bridge between Better Auth (identity)
 * and our RBAC engine (authorization). The pure scope rules live in
 * src/lib/rbac/scope.ts and are tested without a database.
 */

/**
 * Default active club for a user (their primary, else earliest assignment).
 *
 * `cache()`-wrapped: deduped per request so the layout and the page's
 * `requireRole` share one lookup. Memoization is per-render only.
 */
export const resolveActiveClubId = cache(async (userId: string): Promise<string | null> => {
  const assignment = await prisma.userRoleAssignment.findFirst({
    where: { userId, status: "ACTIVE", clubId: { not: null } },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { clubId: true },
  });
  return assignment?.clubId ?? null;
});

/**
 * `cache()`-wrapped on (userId, activeClubId): the shell layout and the page
 * guard resolve the same context once per request instead of twice. Per-render
 * only — never shared across requests, so role/scope changes take effect on the
 * next navigation.
 */
export const loadAuthContext = cache(async (
  userId: string,
  activeClubId: string | null,
  preferredRole: Role | null = null,
): Promise<AuthContext | null> => {
  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId, status: "ACTIVE" },
    select: { clubId: true, teamId: true, role: { select: { code: true } } },
  });
  if (assignments.length === 0) return null;

  // Master Admin is system-scoped and short-circuits the club resolution —
  // unless the caller explicitly switched to a different (club-scoped) identity
  // they also hold (e.g. a master admin who is also a parent), in which case we
  // fall through and resolve that club role below.
  const hasMaster = assignments.some((a) => a.role.code === "MASTER_ADMIN");
  if (hasMaster && (preferredRole == null || preferredRole === "MASTER_ADMIN")) {
    return {
      userId,
      role: "MASTER_ADMIN",
      activeClubId,
      coachTeamIds: [],
      coachTeamPlayerIds: [],
      linkedPlayerIds: [],
      childTeamIds: [],
    };
  }

  if (!activeClubId) return null;

  const rolesInClub = assignments
    .filter((a) => a.clubId === activeClubId && isRole(a.role.code))
    .map((a) => a.role.code as Role);
  if (rolesInClub.length === 0) return null;
  const role = pickActiveRole(rolesInClub, preferredRole);

  // COACH scope: assigned teams = team_coaches OR a scoped role assignment
  // (matrix §11). PARENT scope: linked children + their teams. The coach-side
  // and parent-side lookups are independent of each other, so resolve them
  // concurrently — on Vercel each query is a separate Neon round-trip, and
  // running them serially was the bulk of the context-load latency.
  const assignmentTeamIds = assignments
    .filter((a) => a.role.code === "COACH" && a.clubId === activeClubId && a.teamId != null)
    .map((a) => a.teamId as string);

  const [coachTeams, parentRows] = await Promise.all([
    prisma.teamCoach.findMany({
      where: { userId, clubId: activeClubId, status: "ACTIVE" },
      select: { teamId: true },
    }),
    prisma.parent.findMany({
      where: { userId, clubId: activeClubId, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);

  const coachTeamIds = unique([...coachTeams.map((t) => t.teamId), ...assignmentTeamIds]);
  const parentIds = parentRows.map((p) => p.id);

  // Second wave: coached-team players and linked players are likewise
  // independent — fetch both at once.
  const [coachTeamPlayerIds, linkedPlayerIds] = await Promise.all([
    coachTeamIds.length
      ? prisma.playerTeamMembership
          .findMany({ where: { teamId: { in: coachTeamIds }, status: "ACTIVE" }, select: { playerId: true } })
          .then((rows) => unique(rows.map((m) => m.playerId)))
      : Promise.resolve<string[]>([]),
    parentIds.length
      ? prisma.playerParentLink
          .findMany({ where: { parentId: { in: parentIds }, status: "ACTIVE" }, select: { playerId: true } })
          .then((rows) => unique(rows.map((l) => l.playerId)))
      : Promise.resolve<string[]>([]),
  ]);

  const childTeamIds = linkedPlayerIds.length
    ? unique(
        (
          await prisma.playerTeamMembership.findMany({
            where: { playerId: { in: linkedPlayerIds }, status: "ACTIVE" },
            select: { teamId: true },
          })
        ).map((m) => m.teamId),
      )
    : [];

  return { userId, role, activeClubId, coachTeamIds, coachTeamPlayerIds, linkedPlayerIds, childTeamIds };
});

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
