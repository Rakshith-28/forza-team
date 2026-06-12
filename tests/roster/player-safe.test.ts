import { describe, expect, it } from "vitest";

import { playerSafePlayer, type PlayerLike } from "@/modules/roster/projections";

// A full player record with all the restricted fields populated.
const fullPlayer: PlayerLike = {
  id: "p1",
  firstName: "Alex",
  lastName: "Rivera",
  preferredName: "Lex",
  jerseyNumber: "10",
  primaryPosition: "ST",
  photoUrl: "https://cdn/p1.jpg",
  dateOfBirth: "2012-04-01",
  medicalNotes: "asthma",
  allergyNotes: "peanuts",
  emergencyContactName: "Sam Rivera",
  emergencyContactPhone: "+1-555-0100",
};

describe("playerSafePlayer — projection for OTHER families' children (matrix §6.8/§7.1)", () => {
  const safe = playerSafePlayer(fullPlayer, { showPhotos: true });

  it("exposes only the safe fields", () => {
    expect(Object.keys(safe).sort()).toEqual(
      ["displayName", "id", "jerseyNumber", "photoUrl", "preferredName", "primaryPosition"].sort(),
    );
  });

  it("never leaks restricted PII", () => {
    const serialized = JSON.stringify(safe);
    for (const secret of ["2012-04-01", "asthma", "peanuts", "Sam Rivera", "+1-555-0100"]) {
      expect(serialized).not.toContain(secret);
    }
    // and the keys are simply not present
    const asRecord = safe as unknown as Record<string, unknown>;
    expect(asRecord).not.toHaveProperty("dateOfBirth");
    expect(asRecord).not.toHaveProperty("medicalNotes");
    expect(asRecord).not.toHaveProperty("emergencyContactPhone");
  });

  it("uses preferred name as display name", () => {
    expect(safe.displayName).toBe("Lex");
  });

  it("falls back to full name when no preferred name", () => {
    const s = playerSafePlayer({ ...fullPlayer, preferredName: null });
    expect(s.displayName).toBe("Alex Rivera");
  });

  it("gates the photo behind the club setting (default hidden)", () => {
    expect(playerSafePlayer(fullPlayer).photoUrl).toBeNull();
    expect(playerSafePlayer(fullPlayer, { showPhotos: false }).photoUrl).toBeNull();
    expect(playerSafePlayer(fullPlayer, { showPhotos: true }).photoUrl).toBe("https://cdn/p1.jpg");
  });
});
