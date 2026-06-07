import { describe, expect, it } from "vitest";

import { pickActiveRole } from "@/lib/rbac/roles";

/**
 * Role switching for multi-role users (e.g. a coach who is also a parent).
 * `pickActiveRole` must honour an explicit preference ONLY when the user holds
 * that role — it can never escalate to a role they don't have.
 */
describe("pickActiveRole", () => {
  it("honours a preferred role the user holds", () => {
    expect(pickActiveRole(["COACH", "PARENT"], "PARENT")).toBe("PARENT");
    expect(pickActiveRole(["COACH", "PARENT"], "COACH")).toBe("COACH");
    expect(pickActiveRole(["CLUB_ADMIN", "COACH", "PARENT"], "PARENT")).toBe("PARENT");
  });

  it("falls back to the highest-privilege role when there's no preference", () => {
    expect(pickActiveRole(["COACH", "PARENT"], null)).toBe("COACH");
    expect(pickActiveRole(["CLUB_ADMIN", "COACH"])).toBe("CLUB_ADMIN");
    expect(pickActiveRole(["PARENT", "COACH", "CLUB_ADMIN"])).toBe("CLUB_ADMIN");
  });

  it("ignores a preferred role the user does NOT hold (no escalation)", () => {
    expect(pickActiveRole(["COACH", "PARENT"], "CLUB_ADMIN")).toBe("COACH");
    expect(pickActiveRole(["PARENT"], "COACH")).toBe("PARENT");
    expect(pickActiveRole(["PARENT"], "MASTER_ADMIN")).toBe("PARENT");
  });
});
