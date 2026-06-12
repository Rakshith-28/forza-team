import { describe, expect, it } from "vitest";

import {
  DEFAULT_TEAM_ROLE_TYPE,
  invitationState,
  parseLinkMetadata,
  planInvitationGrants,
} from "@/modules/identity/invitations";

/**
 * accept → grant linking logic, decoupled from Better Auth + the DB so it is
 * unit-testable directly (the seam that previously blocked end-to-end coverage).
 * The DB write itself (applyInvitationGrants) is covered in
 * tests-integration/accept-link.integration.test.ts.
 */

describe("planInvitationGrants", () => {
  const base = { clubId: "club", teamId: null, teamRoleType: null, linkMetadata: null };

  it("COACH + initial team → team_coaches with the chosen role type", () => {
    const g = planInvitationGrants({ ...base, roleCode: "COACH", teamId: "t1", teamRoleType: "HEAD_COACH" });
    expect(g.teamCoachRoleType).toBe("HEAD_COACH");
    expect(g.playerLink).toBeNull();
  });

  it("COACH + initial team + no explicit type → default ASSISTANT_COACH", () => {
    const g = planInvitationGrants({ ...base, roleCode: "COACH", teamId: "t1" });
    expect(g.teamCoachRoleType).toBe(DEFAULT_TEAM_ROLE_TYPE);
    expect(DEFAULT_TEAM_ROLE_TYPE).toBe("ASSISTANT_COACH");
  });

  it("COACH without an initial team → no team_coaches grant", () => {
    expect(planInvitationGrants({ ...base, roleCode: "COACH", teamId: null }).teamCoachRoleType).toBeNull();
  });

  it("PLAYER + link metadata → player link with the carried fields", () => {
    const g = planInvitationGrants({
      ...base,
      roleCode: "PLAYER",
      linkMetadata: { playerId: "p1", relationshipType: "MOTHER", isPrimaryGuardian: true, canPickup: true, canPay: false },
    });
    expect(g.teamCoachRoleType).toBeNull();
    expect(g.playerLink).toEqual({
      playerId: "p1",
      relationshipType: "MOTHER",
      isPrimaryGuardian: true,
      canPickup: true,
      canPay: false,
    });
  });

  it("PLAYER without metadata → no link", () => {
    expect(planInvitationGrants({ ...base, roleCode: "PLAYER" }).playerLink).toBeNull();
  });

  it("PLAYER without a club → no link", () => {
    expect(
      planInvitationGrants({ ...base, clubId: null, roleCode: "PLAYER", linkMetadata: { playerId: "p", relationshipType: "MOTHER" } })
        .playerLink,
    ).toBeNull();
  });

  it("non-coach/non-player (e.g. CLUB_ADMIN) → no grants", () => {
    const g = planInvitationGrants({ ...base, roleCode: "CLUB_ADMIN", teamId: "t1", linkMetadata: { playerId: "p", relationshipType: "X" } });
    expect(g).toEqual({ teamCoachRoleType: null, playerLink: null });
  });
});

describe("parseLinkMetadata defaults + validation", () => {
  it("applies sensible defaults (canPay defaults true; guardian/pickup default false)", () => {
    expect(parseLinkMetadata({ playerId: "p1", relationshipType: "GUARDIAN" })).toEqual({
      playerId: "p1",
      relationshipType: "GUARDIAN",
      isPrimaryGuardian: false,
      canPickup: false,
      canPay: true,
    });
  });
  it("rejects malformed metadata", () => {
    expect(parseLinkMetadata(null)).toBeNull();
    expect(parseLinkMetadata({})).toBeNull();
    expect(parseLinkMetadata({ playerId: "p1" })).toBeNull(); // missing relationshipType
    expect(parseLinkMetadata("nope")).toBeNull();
  });
});

describe("invitationState lifecycle (no re-link of used/expired)", () => {
  const future = new Date(Date.now() + 3_600_000);
  const past = new Date(Date.now() - 3_600_000);

  it("PENDING + unexpired → ok", () => {
    expect(invitationState({ status: "PENDING", acceptedAt: null, expiresAt: future })).toBe("ok");
  });
  it("already accepted → already_used", () => {
    expect(invitationState({ status: "ACCEPTED", acceptedAt: past, expiresAt: future })).toBe("already_used");
    expect(invitationState({ status: "PENDING", acceptedAt: past, expiresAt: future })).toBe("already_used");
  });
  it("expired → expired", () => {
    expect(invitationState({ status: "PENDING", acceptedAt: null, expiresAt: past })).toBe("expired");
  });
});
