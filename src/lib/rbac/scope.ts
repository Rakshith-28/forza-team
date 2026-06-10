import { grantedScope, type Permission } from "@/lib/rbac/permissions";
import type { Role, Scope } from "@/lib/rbac/roles";

/**
 * Resolved authorization context for a request — the caller's effective role in
 * their active club plus the scope sets needed to evaluate TEAM/CHILD access.
 *
 * This is a PURE value object: every function here operates on it without
 * touching the database, which is what makes the scope rules unit-testable
 * (see tests/rbac). The DB-backed loader that builds it lives in
 * src/modules/identity/context.ts.
 */
export interface AuthContext {
  userId: string;
  role: Role;
  /** Active tenant. null only for a MASTER_ADMIN not scoped to one club. */
  activeClubId: string | null;
  /** Teams this user coaches in the active club (COACH team scope). */
  coachTeamIds: string[];
  /**
   * COACH: the single team the coach is currently acting as, from the active
   * identity (`active_identity` cookie → parseIdentityKey().teamId). Team-scoped
   * views (e.g. the roster) narrow to THIS team; `coachTeamIds` stays the full
   * assigned set used for authorization. Optional/omitted ⇒ treated as null (no
   * active team) — callers must NOT union across teams in that case.
   */
  activeTeamId?: string | null;
  /** Players on this user's coached teams (COACH child scope). */
  coachTeamPlayerIds: string[];
  /** Players linked to this user as a parent (PARENT child scope). */
  linkedPlayerIds: string[];
  /** Teams of this parent's linked children (PARENT team-context reads). */
  childTeamIds: string[];
}

/** A resource's scoping coordinates. Provide what's relevant to the check. */
export interface ScopeTarget {
  clubId?: string | null;
  teamId?: string | null;
  playerId?: string | null;
}

/** Thrown by the authoritative service-layer assertions on denial. */
export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "You do not have access to this resource") {
    super(message);
    this.name = "ForbiddenError";
  }
}

const isSystem = (ctx: AuthContext) => ctx.role === "MASTER_ADMIN";
const isClubLevel = (ctx: AuthContext) =>
  ctx.role === "MASTER_ADMIN" || ctx.role === "CLUB_ADMIN";

function clubMatches(ctx: AuthContext, clubId?: string | null): boolean {
  // Master Admin is cross-tenant by design.
  if (isSystem(ctx)) return true;
  if (clubId == null) return true;
  return ctx.activeClubId != null && clubId === ctx.activeClubId;
}

/**
 * Tenant boundary. The single most important check: a non-system user can only
 * ever touch their active club. Cross-tenant access is impossible here.
 */
export function assertClubScope(ctx: AuthContext, clubId: string): void {
  if (!clubMatches(ctx, clubId)) {
    throw new ForbiddenError("Resource belongs to a different club");
  }
}

/** Team boundary: club must match, and a COACH must be assigned to the team. */
export function assertTeamScope(ctx: AuthContext, target: { clubId: string; teamId: string }): void {
  assertClubScope(ctx, target.clubId);
  if (isClubLevel(ctx)) return; // master/club admin have club-wide team authority
  if (ctx.role === "COACH" && ctx.coachTeamIds.includes(target.teamId)) return;
  throw new ForbiddenError("Team is outside your assigned scope");
}

/**
 * Child boundary: club must match, and the player must be reachable —
 * a COACH via their coached teams, a PARENT via their linked children.
 * This is the core parent-safety guard.
 */
export function assertChildScope(ctx: AuthContext, target: { clubId: string; playerId: string }): void {
  assertClubScope(ctx, target.clubId);
  if (isClubLevel(ctx)) return;
  if (ctx.role === "COACH" && ctx.coachTeamPlayerIds.includes(target.playerId)) return;
  if (ctx.role === "PARENT" && ctx.linkedPlayerIds.includes(target.playerId)) return;
  throw new ForbiddenError("Player is outside your scope");
}

function scopeSatisfied(ctx: AuthContext, scope: Scope, target: ScopeTarget): boolean {
  switch (scope) {
    case "SYSTEM":
      return isSystem(ctx);
    case "CLUB":
      return clubMatches(ctx, target.clubId);
    case "TEAM": {
      if (!clubMatches(ctx, target.clubId)) return false;
      if (isClubLevel(ctx)) return true;
      // COACH: a team target must be assigned; a player target must be on an
      // assigned team (e.g. scoring an evaluation for a specific player).
      if (target.teamId != null) return ctx.coachTeamIds.includes(target.teamId);
      if (target.playerId != null) return ctx.coachTeamPlayerIds.includes(target.playerId);
      return ctx.coachTeamIds.length > 0;
    }
    case "CHILD": {
      if (!clubMatches(ctx, target.clubId)) return false;
      if (isClubLevel(ctx)) return true;
      if (target.playerId != null) {
        return (
          ctx.linkedPlayerIds.includes(target.playerId) ||
          ctx.coachTeamPlayerIds.includes(target.playerId)
        );
      }
      if (target.teamId != null) return ctx.childTeamIds.includes(target.teamId);
      // child-scope listing within the club ("my kids")
      return ctx.linkedPlayerIds.length > 0;
    }
  }
}

/**
 * Non-throwing permission check for UI/conditional logic. Combines the role's
 * granted scope for `permission` (from the matrix catalog) with the caller's
 * resolved scope. Service mutations should additionally call the assert*
 * helpers — the service layer is authoritative.
 */
export function can(ctx: AuthContext, permission: Permission, target: ScopeTarget = {}): boolean {
  const scope = grantedScope(ctx.role, permission);
  if (scope == null) return false;
  return scopeSatisfied(ctx, scope, target);
}

/** Throwing variant of {@link can} for guard clauses. */
export function assertCan(ctx: AuthContext, permission: Permission, target: ScopeTarget = {}): void {
  if (!can(ctx, permission, target)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
}
