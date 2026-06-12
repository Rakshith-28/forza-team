import { describe, expect, it } from "vitest";

import { grantedScope, PERMISSIONS, roleHasPermission } from "@/lib/rbac/permissions";
import { ROLES } from "@/lib/rbac/roles";

describe("permission catalog (RBAC matrix §10)", () => {
  it("only references the four known roles", () => {
    for (const grants of Object.values(PERMISSIONS)) {
      for (const role of Object.keys(grants)) {
        expect(ROLES).toContain(role);
      }
    }
  });

  it("never grants coaches financial access (§6.16, §12.4)", () => {
    expect(roleHasPermission("COACH", "billing.manage")).toBe(false);
    expect(grantedScope("COACH", "billing.view_own_family")).toBeNull();
  });

  it("never grants players team-wide evaluation/ranking views (§6.18, §12.3)", () => {
    expect(roleHasPermission("PLAYER", "evaluations.view_team")).toBe(false);
    expect(roleHasPermission("PLAYER", "evaluations.manage_templates")).toBe(false);
  });

  it("restricts audit log access to admins (§6.23)", () => {
    expect(grantedScope("MASTER_ADMIN", "audit.view")).toBe("SYSTEM");
    expect(grantedScope("CLUB_ADMIN", "audit.view")).toBe("CLUB");
    expect(roleHasPermission("COACH", "audit.view")).toBe(false);
    expect(roleHasPermission("PLAYER", "audit.view")).toBe(false);
  });

  it("scopes coach capabilities to TEAM and player capabilities to CHILD", () => {
    expect(grantedScope("COACH", "attendance.record")).toBe("TEAM");
    expect(grantedScope("COACH", "roster.view_full")).toBe("TEAM");
    expect(grantedScope("PLAYER", "attendance.view_own_child")).toBe("CHILD");
    expect(grantedScope("PLAYER", "roster.view_safe")).toBe("CHILD");
  });

  it("only lets admins manage clubs/teams (§6.2, §6.4)", () => {
    expect(roleHasPermission("COACH", "teams.manage")).toBe(false);
    expect(roleHasPermission("PLAYER", "teams.manage")).toBe(false);
    expect(grantedScope("CLUB_ADMIN", "teams.manage")).toBe("CLUB");
    expect(grantedScope("MASTER_ADMIN", "teams.manage")).toBe("SYSTEM");
  });
});
