import "server-only";

import { prisma } from "@/db/client";
import { isRole, type Role } from "@/lib/rbac/roles";
import type { AuthContext } from "@/lib/rbac/scope";

/**
 * Builds the request's {@link AuthContext} from our own authorization tables
 * (`user_role_assignments`, `team_coaches`, `parents`/`player_parent_links`,
 * `player_team_memberships`). This is the bridge between Better Auth (identity)
 * and our RBAC engine (authorization). The pure scope rules live in
 * src/lib/rbac/scope.ts and are tested without a database.
 */

// When a user has multiple roles in one club (e.g. coach + parent), MVP picks
// the highest-privilege one as the active context (matrix §2: one role at a time).
const ROLE_PRIORITY: Record<Role, number> = {
  MASTER_ADMIN: 4,
  CLUB_ADMIN: 3,
  COACH: 2,
  PARENT: 1,
};

/** Default active club for a user (their primary, else earliest assignment). */
export async function resolveActiveClubId(userId: string): Promise<string | null> {
  const assignment = await prisma.userRoleAssignment.findFirst({
    where: { userId, status: "ACTIVE", clubId: { not: null } },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { clubId: true },
  });
  return assignment?.clubId ?? null;
}

export async function loadAuthContext(
  userId: string,
  activeClubId: string | null,
): Promise<AuthContext | null> {
  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId, status: "ACTIVE" },
    select: { clubId: true, teamId: true, role: { select: { code: true } } },
  });
  if (assignments.length === 0) return null;

  // Master Admin is system-scoped and short-circuits the club resolution.
  if (assignments.some((a) => a.role.code === "MASTER_ADMIN")) {
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
  const role = rolesInClub.sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a])[0];

  // COACH scope: assigned teams = team_coaches OR a scoped role assignment
  // (matrix §11). Take the union of both sources.
  const coachTeams = await prisma.teamCoach.findMany({
    where: { userId, clubId: activeClubId, status: "ACTIVE" },
    select: { teamId: true },
  });
  const assignmentTeamIds = assignments
    .filter((a) => a.role.code === "COACH" && a.clubId === activeClubId && a.teamId != null)
    .map((a) => a.teamId as string);
  const coachTeamIds = unique([...coachTeams.map((t) => t.teamId), ...assignmentTeamIds]);
  const coachTeamPlayerIds = coachTeamIds.length
    ? unique(
        (
          await prisma.playerTeamMembership.findMany({
            where: { teamId: { in: coachTeamIds }, status: "ACTIVE" },
            select: { playerId: true },
          })
        ).map((m) => m.playerId),
      )
    : [];

  // PARENT scope: linked children + the teams those children are on.
  const parentRows = await prisma.parent.findMany({
    where: { userId, clubId: activeClubId, status: "ACTIVE" },
    select: { id: true },
  });
  const parentIds = parentRows.map((p) => p.id);
  const linkedPlayerIds = parentIds.length
    ? unique(
        (
          await prisma.playerParentLink.findMany({
            where: { parentId: { in: parentIds }, status: "ACTIVE" },
            select: { playerId: true },
          })
        ).map((l) => l.playerId),
      )
    : [];
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
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
