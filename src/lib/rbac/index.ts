export {
  ROLES,
  SCOPES,
  ROLE_LABELS,
  ROLE_HOME,
  isRole,
  type Role,
  type Scope,
} from "@/lib/rbac/roles";

export {
  PERMISSIONS,
  grantedScope,
  roleHasPermission,
  type Permission,
} from "@/lib/rbac/permissions";

export {
  can,
  assertCan,
  assertClubScope,
  assertTeamScope,
  assertChildScope,
  ForbiddenError,
  type AuthContext,
  type ScopeTarget,
} from "@/lib/rbac/scope";
