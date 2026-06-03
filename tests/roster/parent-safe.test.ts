import { describe, expect, it } from "vitest";

import { parentSafePlayer, type PlayerLike } from "@/modules/roster/projections";

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

describe("parentSafePlayer — projection for OTHER families' children (matrix §6.8/§7.1)", () => {
  const safe = parentSafePlayer(fullPlayer, { showPhotos: true });

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
    const s = parentSafePlayer({ ...fullPlayer, preferredName: null });
    expect(s.displayName).toBe("Alex Rivera");
  });

  it("gates the photo behind the club setting (default hidden)", () => {
    expect(parentSafePlayer(fullPlayer).photoUrl).toBeNull();
    expect(parentSafePlayer(fullPlayer, { showPhotos: false }).photoUrl).toBeNull();
    expect(parentSafePlayer(fullPlayer, { showPhotos: true }).photoUrl).toBe("https://cdn/p1.jpg");
  });
});
