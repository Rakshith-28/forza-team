import { describe, expect, it } from "vitest";

import type { Role } from "@/lib/rbac/roles";
import {
  identityKey,
  parseIdentityKey,
  pickDefaultIdentity,
  resolveIdentity,
  type Identity,
} from "@/modules/identity/identities";

// --- Fixtures ---------------------------------------------------------------
const CLUB = "club-1";
const TEAM = "team-1";
const CHILD = "player-1";

function ident(over: Partial<Identity> & { role: Role; key: string }): Identity {
  return {
    clubId: CLUB,
    teamId: null,
    playerId: null,
    roleLabel: over.role,
    contextLabel: "X",
    clubName: "Club One",
    ...over,
  };
}

const coach = ident({ role: "COACH", key: identityKey({ role: "COACH", clubId: CLUB, teamId: TEAM }), teamId: TEAM, contextLabel: "U14 Boys" });
const parent = ident({ role: "PARENT", key: identityKey({ role: "PARENT", clubId: CLUB, playerId: CHILD }), playerId: CHILD, contextLabel: "Sohaan" });
const clubAdmin = ident({ role: "CLUB_ADMIN", key: identityKey({ role: "CLUB_ADMIN", clubId: CLUB }), contextLabel: "Club One" });

describe("identityKey + parseIdentityKey", () => {
  it("formats a coach key with role|club|team|", () => {
    expect(identityKey({ role: "COACH", clubId: CLUB, teamId: TEAM })).toBe("COACH|club-1|team-1|");
  });

  it("formats a parent key with role|club||player", () => {
    expect(identityKey({ role: "PARENT", clubId: CLUB, playerId: CHILD })).toBe("PARENT|club-1||player-1");
  });

  it("formats a system master key with no club/team/child", () => {
    expect(identityKey({ role: "MASTER_ADMIN" })).toBe("MASTER_ADMIN|||");
  });

  it("round-trips a coach key back to its coordinates", () => {
    const key = identityKey({ role: "COACH", clubId: CLUB, teamId: TEAM });
    expect(parseIdentityKey(key)).toEqual({ role: "COACH", clubId: CLUB, teamId: TEAM, playerId: null });
  });

  it("round-trips a parent key", () => {
    const key = identityKey({ role: "PARENT", clubId: CLUB, playerId: CHILD });
    expect(parseIdentityKey(key)).toEqual({ role: "PARENT", clubId: CLUB, teamId: null, playerId: CHILD });
  });

  it("maps a master key to a null club (system scope)", () => {
    expect(parseIdentityKey("MASTER_ADMIN|||")).toEqual({
      role: "MASTER_ADMIN",
      clubId: null,
      teamId: null,
      playerId: null,
    });
  });

  it("rejects a forged/unknown role — degrades to null, never a real role", () => {
    expect(parseIdentityKey("SUPERUSER|club-1||")).toBeNull();
    expect(parseIdentityKey("|club-1||")).toBeNull();
  });

  it("returns null for empty/undefined input", () => {
    expect(parseIdentityKey("")).toBeNull();
    expect(parseIdentityKey(null)).toBeNull();
    expect(parseIdentityKey(undefined)).toBeNull();
  });
});

describe("pickDefaultIdentity", () => {
  it("returns null for an empty list", () => {
    expect(pickDefaultIdentity([])).toBeNull();
  });

  it("returns the first identity (the list is pre-sorted by privilege)", () => {
    expect(pickDefaultIdentity([clubAdmin, coach, parent])).toBe(clubAdmin);
  });
});

describe("resolveIdentity — safe fallback", () => {
  const list = [clubAdmin, coach, parent];

  it("returns the identity matching the cookie key", () => {
    expect(resolveIdentity(list, parent.key)).toBe(parent);
  });

  it("falls back to the default when the key is unknown (never selects an arbitrary entry)", () => {
    // A forged key for a club/role the user doesn't hold resolves to their
    // OWN default identity, not the forged target — no escalation.
    expect(resolveIdentity(list, "COACH|other-club|other-team|")).toBe(clubAdmin);
  });

  it("falls back to the default when no key is set", () => {
    expect(resolveIdentity(list, null)).toBe(clubAdmin);
  });

  it("returns null when the user has no identities", () => {
    expect(resolveIdentity([], parent.key)).toBeNull();
  });
});
