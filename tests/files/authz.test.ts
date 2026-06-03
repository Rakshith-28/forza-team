import { describe, expect, it } from "vitest";

import { can, ForbiddenError, type AuthContext } from "@/lib/rbac";
import { uploadClubDocument } from "@/modules/files/service";
import { UploadValidationError, validateUpload } from "@/modules/files/schemas";
import { parentSafePlayer, type PlayerLike } from "@/modules/roster/projections";

/**
 * Phase 4 authorization + validation for files (RBAC matrix §6.9). Service
 * guards reject before DB access; validation is pure; the photo-visibility
 * setting is re-checked here as a Phase 3 regression.
 */

const CLUB_A = "club-a";
const CLUB_B = "club-b";

function ctx(overrides: Partial<AuthContext>): AuthContext {
  return {
    userId: "u",
    role: "CLUB_ADMIN",
    activeClubId: CLUB_A,
    coachTeamIds: [],
    coachTeamPlayerIds: [],
    linkedPlayerIds: [],
    childTeamIds: [],
    ...overrides,
  };
}

const clubAdminA = ctx({ role: "CLUB_ADMIN", activeClubId: CLUB_A });
const coachA = ctx({ role: "COACH", activeClubId: CLUB_A, coachTeamIds: ["t1"], coachTeamPlayerIds: ["p1"] });
const parentA = ctx({ role: "PARENT", activeClubId: CLUB_A, linkedPlayerIds: ["kid"], childTeamIds: ["t2"] });

const PNG = { originalName: "a.png", mimeType: "image/png", size: 1000 };

// ---------------------------------------------------------------------------
// 8 + 9 — Upload/manage scope
// ---------------------------------------------------------------------------
describe("club document management scope", () => {
  it("only admins manage club documents", () => {
    expect(can(clubAdminA, "documents.manage_club", { clubId: CLUB_A })).toBe(true);
    expect(can(coachA, "documents.manage_club", { clubId: CLUB_A })).toBe(false);
    expect(can(parentA, "documents.manage_club", { clubId: CLUB_A })).toBe(false);
  });

  it("rejects club-document upload for non-admins (before DB)", async () => {
    await expect(uploadClubDocument(coachA, CLUB_A, { bytes: Buffer.from("x"), ...PNG })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(uploadClubDocument(parentA, CLUB_A, { bytes: Buffer.from("x"), ...PNG })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("rejects cross-club document upload", async () => {
    await expect(uploadClubDocument(clubAdminA, CLUB_B, { bytes: Buffer.from("x"), ...PNG })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("club members can view shared docs; chat attachments ride team scope", () => {
    expect(can(coachA, "documents.view", { clubId: CLUB_A })).toBe(true);
    expect(can(parentA, "documents.view", { clubId: CLUB_A })).toBe(true);
    expect(can(coachA, "documents.view", { clubId: CLUB_B })).toBe(false);
    // Coach team-doc sharing = chat attachment on an assigned team only.
    expect(can(coachA, "chat.send_team", { clubId: CLUB_A, teamId: "t1" })).toBe(true);
    expect(can(coachA, "chat.send_team", { clubId: CLUB_A, teamId: "t-unassigned" })).toBe(false);
  });
});

describe("player-photo upload scope (reuses Phase 3 player-edit permissions)", () => {
  it("parent may set only their own child's photo", () => {
    expect(can(parentA, "players.edit_limited_own_child", { clubId: CLUB_A, playerId: "kid" })).toBe(true);
    expect(can(parentA, "players.edit_limited_own_child", { clubId: CLUB_A, playerId: "other-kid" })).toBe(false);
  });
  it("coach may set photos only for assigned-team players", () => {
    expect(can(coachA, "players.edit_full", { clubId: CLUB_A, playerId: "p1" })).toBe(true);
    expect(can(coachA, "players.edit_full", { clubId: CLUB_A, playerId: "p-elsewhere" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10 — Upload validation (MIME / extension / size)
// ---------------------------------------------------------------------------
describe("upload validation", () => {
  it("accepts a valid image for a player photo", () => {
    expect(validateUpload("PLAYER_PHOTO", { originalName: "kid.jpg", mimeType: "image/jpeg", size: 2000 })).toBe(".jpg");
  });
  it("rejects a disallowed MIME type", () => {
    expect(() => validateUpload("PLAYER_PHOTO", { originalName: "x.exe", mimeType: "application/x-msdownload", size: 10 })).toThrow(
      UploadValidationError,
    );
  });
  it("rejects a mismatched / disallowed extension", () => {
    expect(() => validateUpload("PLAYER_PHOTO", { originalName: "x.gif", mimeType: "image/png", size: 10 })).toThrow(
      UploadValidationError,
    );
  });
  it("rejects an oversize file", () => {
    expect(() => validateUpload("PLAYER_PHOTO", { originalName: "x.png", mimeType: "image/png", size: 10 * 1024 * 1024 })).toThrow(
      UploadValidationError,
    );
  });
  it("rejects an empty file", () => {
    expect(() => validateUpload("CLUB_DOCUMENT", { originalName: "x.pdf", mimeType: "application/pdf", size: 0 })).toThrow(
      UploadValidationError,
    );
  });
});

// ---------------------------------------------------------------------------
// 11 — show_player_photos_to_parents=false hides photos (Phase 3 regression)
// ---------------------------------------------------------------------------
describe("parent photo visibility setting", () => {
  const player: PlayerLike = {
    id: "p",
    firstName: "A",
    lastName: "B",
    preferredName: null,
    jerseyNumber: "7",
    primaryPosition: "MID",
    photoUrl: "/api/files/abc",
  };
  it("hides the photo when the club setting is off", () => {
    expect(parentSafePlayer(player, { showPhotos: false }).photoUrl).toBeNull();
    expect(parentSafePlayer(player).photoUrl).toBeNull();
  });
  it("shows the proxy URL when the setting is on", () => {
    expect(parentSafePlayer(player, { showPhotos: true }).photoUrl).toBe("/api/files/abc");
  });
});
