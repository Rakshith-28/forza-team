import type { Role, Scope } from "@/lib/rbac/roles";

/**
 * Permission catalog — the authoritative encoding of docs/soccer_club_rbac_matrix.md.
 *
 * Each permission (the matrix's §10 constants) maps to the roles that hold it
 * and the SCOPE at which each role holds it. `can()` (scope.ts) combines this
 * with the caller's resolved scope sets to make the final decision. Feature
 * phases (2–7) consume these constants; they are not re-derived per feature.
 *
 * Scope meanings: SYSTEM = all clubs (Master Admin); CLUB = own club; TEAM =
 * assigned team(s); CHILD = linked child(ren) / own family.
 */
export const PERMISSIONS = {
  // Clubs (§6.2)
  "clubs.view": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },
  "clubs.manage": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },

  // Seasons (§6.3)
  "seasons.view": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM", PARENT: "CHILD" },
  "seasons.manage": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },

  // Teams (§6.4) — teams.manage also gates coach assignment (§6.5)
  "teams.view": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM", PARENT: "CHILD" },
  "teams.manage": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },

  // Roster / players (§6.6, §6.8)
  "roster.view_full": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },
  "roster.view_safe": { PARENT: "CHILD" },
  "players.create": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },
  "players.edit_full": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },
  "players.edit_limited_own_child": {
    MASTER_ADMIN: "SYSTEM",
    CLUB_ADMIN: "CLUB",
    COACH: "TEAM",
    PARENT: "CHILD",
  },

  // Parents (§6.7)
  "parents.manage": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },

  // Schedule / RSVP / attendance (§6.12–6.14)
  "events.view": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM", PARENT: "CHILD" },
  "events.manage": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },
  // Parent for a linked child; admin/coach may override (RBAC matrix §6.13).
  "rsvp.respond_own_child": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM", PARENT: "CHILD" },
  "attendance.record": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },
  "attendance.view_team": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },
  "attendance.view_own_child": { PARENT: "CHILD" },

  // Registration (§6.15)
  "registrations.manage": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },
  "registrations.submit_own_child": {
    MASTER_ADMIN: "SYSTEM",
    CLUB_ADMIN: "CLUB",
    PARENT: "CHILD",
  },

  // Billing (§6.16) — coaches get NO financial access by default
  "billing.manage": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },
  "billing.view_own_family": { PARENT: "CHILD" },

  // Waivers (§6.17)
  "waivers.manage": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },
  "waivers.accept_own_child": {
    MASTER_ADMIN: "SYSTEM",
    CLUB_ADMIN: "CLUB",
    PARENT: "CHILD",
  },

  // Evaluations (§6.18) — parents never see team ranking/radar
  "evaluations.manage_templates": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },
  "evaluations.score_players": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },
  "evaluations.view_team": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },
  "evaluations.view_own_child_summary": { PARENT: "CHILD" },

  // Development tracking (§6.19)
  "development.manage": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },
  "development.view_own_child": { PARENT: "CHILD" },

  // Announcements (§6.10)
  "announcements.view": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM", PARENT: "CHILD" },
  "announcements.publish_club": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },
  "announcements.publish_team": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },

  // Chat (§6.11) — parents may read/post in their linked child's team chat
  "chat.view_team": {
    MASTER_ADMIN: "SYSTEM",
    CLUB_ADMIN: "CLUB",
    COACH: "TEAM",
    PARENT: "CHILD",
  },
  "chat.send_team": {
    MASTER_ADMIN: "SYSTEM",
    CLUB_ADMIN: "CLUB",
    COACH: "TEAM",
    PARENT: "CHILD",
  },
  // Admin/coach may moderate (delete) messages within their scope.
  "chat.moderate_team": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },

  // Files / documents (§6.9) — club-shared docs + player photos + chat files.
  // Club documents are club-wide, so members view at CLUB scope; managing them
  // (upload/delete) stays with admins. Team-scoped sharing rides on team chat
  // attachments; player photos reuse the Phase 3 player-edit permissions.
  "documents.view": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "CLUB", PARENT: "CLUB" },
  "documents.manage_club": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },
  // Team documents (Phase 5): coach manages docs for assigned teams; admins club-wide.
  // Viewing a team document reuses teams.view (coach=assigned, parent=child team).
  "documents.manage_team": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },

  // Reports (§6.21)
  "reports.view_club": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },
  "reports.view_team": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },

  // AI assistant (§6.22)
  "ai.use_admin": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },
  "ai.use_coach": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB", COACH: "TEAM" },

  // Audit logs (§6.23)
  "audit.view": { MASTER_ADMIN: "SYSTEM", CLUB_ADMIN: "CLUB" },
} as const satisfies Record<string, Partial<Record<Role, Scope>>>;

export type Permission = keyof typeof PERMISSIONS;

/** The scope at which `role` holds `permission`, or null if it doesn't hold it. */
export function grantedScope(role: Role, permission: Permission): Scope | null {
  const grants = PERMISSIONS[permission] as Partial<Record<Role, Scope>>;
  return grants[role] ?? null;
}

/** Coarse role-level check, ignoring scope (use `can()` for the scoped check). */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return grantedScope(role, permission) !== null;
}
