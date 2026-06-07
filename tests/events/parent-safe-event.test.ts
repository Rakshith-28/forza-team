import { describe, expect, it } from "vitest";

import { toParentSafeEvent, type ParentSafeEventInput } from "@/modules/events/service";

/**
 * The parent-safe event projection must expose only public event fields + the
 * linked child's OWN RSVP, never another child's response or any extra data
 * (BUILD_PLAN §2 child-safety).
 */
const base: ParentSafeEventInput = {
  id: "e1",
  title: "Game vs Rivals",
  eventType: "GAME",
  audienceScope: "TEAMS",
  startAt: new Date("2026-06-10T18:00:00Z"),
  endAt: new Date("2026-06-10T20:00:00Z"),
  timezone: "America/New_York",
  locationName: "Field 1",
  status: "SCHEDULED",
  eventTeams: [{ teamId: "t1", team: { id: "t1", name: "U12" } }],
  rsvps: [
    { playerId: "childA", responseStatus: "GOING" },
    { playerId: "childB", responseStatus: "NOT_GOING" },
  ],
};

describe("toParentSafeEvent", () => {
  it("exposes only the linked child's own RSVP", () => {
    expect(toParentSafeEvent(base, { childId: "childA" }).myRsvp).toBe("GOING");
    expect(toParentSafeEvent(base, { childId: "childB" }).myRsvp).toBe("NOT_GOING");
  });

  it("never leaks another child's id or response", () => {
    const serialized = JSON.stringify(toParentSafeEvent(base, { childId: "childA" }));
    expect(serialized).not.toContain("childB");
    expect(serialized).not.toContain("NOT_GOING");
  });

  it("does not carry the raw rsvps array through the projection", () => {
    const safe = toParentSafeEvent(base, { childId: "childA" }) as unknown as Record<string, unknown>;
    expect(safe.rsvps).toBeUndefined();
  });

  it("returns team tags + public fields", () => {
    const safe = toParentSafeEvent(base, { childId: "childA" });
    expect(safe.teams).toEqual([{ id: "t1", name: "U12" }]);
    expect(safe.title).toBe("Game vs Rivals");
    expect(safe.locationName).toBe("Field 1");
  });

  it("returns null RSVP when the child has not responded", () => {
    expect(toParentSafeEvent({ ...base, rsvps: [] }, { childId: "childA" }).myRsvp).toBeNull();
  });
});
