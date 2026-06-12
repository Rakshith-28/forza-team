import { describe, expect, it } from "vitest";

import { ForbiddenError, type AuthContext } from "@/lib/rbac";
import { planInvitationGrants } from "@/modules/identity/invitations";
import {
  clubAdminState,
  getAuditFilterOptions,
  getClubAdmins,
  getMasterAuditLogs,
  getMasterClubDetail,
  getMasterClubs,
  getMasterCoachDetail,
  getMasterCoaches,
  getMasterDashboardSummary,
  getMasterUserDetail,
  getMasterUsers,
  getSystemSettings,
  inviteClubAdmin,
  listClubOptions,
  resendClubAdminInvite,
  revokeClubAdminInvite,
  setClubStatus,
  updateSystemSettings,
} from "@/modules/master/service";
import { normalizePage, parseIntParam, updateSystemSettingsSchema } from "@/modules/master/schemas";

/**
 * Master module authorization. Every master service asserts MASTER_ADMIN as its
 * first line — BEFORE any DB access — so non-master roles are provably rejected
 * without a database (matching the established guard-level test style). DB-backed
 * list/filter behavior lives in tests-integration/master.integration.test.ts.
 */

function ctx(overrides: Partial<AuthContext>): AuthContext {
  return {
    userId: "u",
    role: "CLUB_ADMIN",
    activeClubId: "club-a",
    coachTeamIds: [],
    coachTeamPlayerIds: [],
    linkedPlayerIds: [],
    childTeamIds: [],
    ...overrides,
  };
}

const clubAdmin = ctx({ role: "CLUB_ADMIN" });
const coach = ctx({ role: "COACH", coachTeamIds: ["t1"] });
const player = ctx({ role: "PLAYER", linkedPlayerIds: ["kid"] });
const nonMasters = [
  ["club admin", clubAdmin],
  ["coach", coach],
  ["player", player],
] as const;

const SETTINGS_INPUT = {
  aiFeaturesEnabled: true,
  maintenanceMode: false,
  defaultCurrency: "USD",
  defaultRegistrationEnabled: true,
  defaultBillingEnabled: true,
  defaultSmsNotifications: false,
};

describe("master services reject non-master roles before DB access", () => {
  for (const [label, c] of nonMasters) {
    it(`rejects ${label}`, async () => {
      await expect(getMasterDashboardSummary(c)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getMasterClubs(c)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getMasterClubDetail(c, "club-a")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(setClubStatus(c, "club-a", "SUSPENDED")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listClubOptions(c)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getMasterCoaches(c)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getMasterCoachDetail(c, "u2")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getMasterUsers(c)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getMasterUserDetail(c, "u2")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getMasterAuditLogs(c)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getAuditFilterOptions(c)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getSystemSettings(c)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(updateSystemSettings(c, SETTINGS_INPUT)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getClubAdmins(c, "club-a")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(inviteClubAdmin(c, "club-a", { email: "a@b.com" })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(resendClubAdminInvite(c, "inv-1")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(revokeClubAdminInvite(c, "inv-1")).rejects.toBeInstanceOf(ForbiddenError);
    });
  }
});

describe("clubAdminState (orphan indicator)", () => {
  it("ok when an active admin exists (regardless of pending invites)", () => {
    expect(clubAdminState(true, false)).toBe("ok");
    expect(clubAdminState(true, true)).toBe("ok");
  });
  it("pending when only an invite is out", () => {
    expect(clubAdminState(false, true)).toBe("pending");
  });
  it("none (orphan) when there is neither", () => {
    expect(clubAdminState(false, false)).toBe("none");
  });
});

describe("CLUB_ADMIN acceptance grants", () => {
  it("plans no side-grants, so acceptance yields only the role assignment", () => {
    // The full acceptInvitation (Better Auth signUpEmail) needs a request context
    // and is exercised in the auth flow; its CLUB_ADMIN path creates a
    // user_role_assignment and applies these (empty) grants.
    expect(
      planInvitationGrants({ roleCode: "CLUB_ADMIN", clubId: "club-a", teamId: null, teamRoleType: null, linkMetadata: null }),
    ).toEqual({ teamCoachRoleType: null, playerLink: null });
  });
});

describe("normalizePage", () => {
  it("defaults to page 1, size 20", () => {
    expect(normalizePage()).toEqual({ page: 1, pageSize: 20, skip: 0, take: 20 });
  });
  it("computes skip from page/size", () => {
    expect(normalizePage({ page: 3, pageSize: 10 })).toEqual({ page: 3, pageSize: 10, skip: 20, take: 10 });
  });
  it("clamps an oversized page size to 100", () => {
    expect(normalizePage({ pageSize: 9999 }).pageSize).toBe(100);
  });
  it("coerces page < 1 back to 1", () => {
    expect(normalizePage({ page: 0 }).page).toBe(1);
    expect(normalizePage({ page: -5 }).page).toBe(1);
  });
});

describe("parseIntParam", () => {
  it("parses a numeric string", () => {
    expect(parseIntParam("5")).toBe(5);
  });
  it("returns undefined for absent or non-numeric input", () => {
    expect(parseIntParam(undefined)).toBeUndefined();
    expect(parseIntParam("abc")).toBeUndefined();
  });
});

describe("updateSystemSettingsSchema", () => {
  it("accepts a valid payload", () => {
    expect(updateSystemSettingsSchema.safeParse(SETTINGS_INPUT).success).toBe(true);
  });
  it("rejects an unsupported currency", () => {
    expect(updateSystemSettingsSchema.safeParse({ ...SETTINGS_INPUT, defaultCurrency: "XYZ" }).success).toBe(false);
  });
  it("rejects a non-boolean flag", () => {
    expect(updateSystemSettingsSchema.safeParse({ ...SETTINGS_INPUT, maintenanceMode: "yes" }).success).toBe(false);
  });
});
