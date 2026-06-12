import { describe, expect, it } from "vitest";

import { pickActiveRole } from "@/lib/rbac/roles";

/**
 * Role switching for multi-role users (e.g. a coach who is also a player).
 * `pickActiveRole` must honour an explicit preference ONLY when the user holds
 * that role — it can never escalate to a role they don't have.
 */
describe("pickActiveRole", () => {
  it("honours a preferred role the user holds", () => {
    expect(pickActiveRole(["COACH", "PLAYER"], "PLAYER")).toBe("PLAYER");
    expect(pickActiveRole(["COACH", "PLAYER"], "COACH")).toBe("COACH");
    expect(pickActiveRole(["CLUB_ADMIN", "COACH", "PLAYER"], "PLAYER")).toBe("PLAYER");
  });

  it("falls back to the highest-privilege role when there's no preference", () => {
    expect(pickActiveRole(["COACH", "PLAYER"], null)).toBe("COACH");
    expect(pickActiveRole(["CLUB_ADMIN", "COACH"])).toBe("CLUB_ADMIN");
    expect(pickActiveRole(["PLAYER", "COACH", "CLUB_ADMIN"])).toBe("CLUB_ADMIN");
  });

  it("ignores a preferred role the user does NOT hold (no escalation)", () => {
    expect(pickActiveRole(["COACH", "PLAYER"], "CLUB_ADMIN")).toBe("COACH");
    expect(pickActiveRole(["PLAYER"], "COACH")).toBe("PLAYER");
    expect(pickActiveRole(["PLAYER"], "MASTER_ADMIN")).toBe("PLAYER");
  });
});
