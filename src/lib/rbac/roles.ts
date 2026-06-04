/**
 * The four roles and four scopes (BUILD_PLAN §2, RBAC matrix §2/§4).
 * Roles are stored as `roles.code` and on `user_role_assignments`; scopes are
 * derived from which of `club_id` / `team_id` / child-linkage applies.
 */

export const ROLES = ["MASTER_ADMIN", "CLUB_ADMIN", "COACH", "PARENT"] as const;
export type Role = (typeof ROLES)[number];

export const SCOPES = ["SYSTEM", "CLUB", "TEAM", "CHILD"] as const;
export type Scope = (typeof SCOPES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  MASTER_ADMIN: "Master Admin",
  CLUB_ADMIN: "Club Manager",
  COACH: "Coach",
  PARENT: "Parent / Guardian",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Where each role lands after sign-in (RBAC matrix §8). */
export const ROLE_HOME: Record<Role, string> = {
  MASTER_ADMIN: "/dashboard/admin",
  CLUB_ADMIN: "/dashboard/club",
  COACH: "/dashboard/coach",
  PARENT: "/dashboard/parent",
};
