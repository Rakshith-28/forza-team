import { describe, expect, it } from "vitest";

import { can, ForbiddenError, type AuthContext } from "@/lib/rbac";
import { canSetPlayerPhoto, uploadClubDocument } from "@/modules/files/service";
import { UploadValidationError, validateUpload } from "@/modules/files/schemas";
import { playerSafePlayer, type PlayerLike } from "@/modules/roster/projections";

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
const playerA = ctx({ role: "PLAYER", activeClubId: CLUB_A, linkedPlayerIds: ["kid"], childTeamIds: ["t2"] });

const PNG = { originalName: "a.png", mimeType: "image/png", size: 1000 };

// ---------------------------------------------------------------------------
// 8 + 9 — Upload/manage scope
// ---------------------------------------------------------------------------
describe("club document management scope", () => {
  it("only admins manage club documents", () => {
    expect(can(clubAdminA, "documents.manage_club", { clubId: CLUB_A })).toBe(true);
    expect(can(coachA, "documents.manage_club", { clubId: CLUB_A })).toBe(false);
    expect(can(playerA, "documents.manage_club", { clubId: CLUB_A })).toBe(false);
  });

  it("rejects club-document upload for non-admins (before DB)", async () => {
    await expect(uploadClubDocument(coachA, CLUB_A, { bytes: Buffer.from("x"), ...PNG })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(uploadClubDocument(playerA, CLUB_A, { bytes: Buffer.from("x"), ...PNG })).rejects.toBeInstanceOf(
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
    expect(can(playerA, "documents.view", { clubId: CLUB_A })).toBe(true);
    expect(can(coachA, "documents.view", { clubId: CLUB_B })).toBe(false);
    // Coach team-doc sharing = chat attachment on an assigned team only.
    expect(can(coachA, "chat.send_team", { clubId: CLUB_A, teamId: "t1" })).toBe(true);
    expect(can(coachA, "chat.send_team", { clubId: CLUB_A, teamId: "t-unassigned" })).toBe(false);
  });
});

describe("player-photo upload scope (player's own account only)", () => {
  // A player's photo is owned by the family: canSetPlayerPhoto requires role=PLAYER
  // + own-child scope, so staff (who hold the broader edit perms) can never set it.
  it("a player may set only their own child's photo", () => {
    expect(canSetPlayerPhoto(playerA, CLUB_A, "kid")).toBe(true);
    expect(canSetPlayerPhoto(playerA, CLUB_A, "other-kid")).toBe(false);
  });
  it("staff (coach / admin) cannot set a player's photo, even within scope", () => {
    expect(canSetPlayerPhoto(coachA, CLUB_A, "p1")).toBe(false);
    expect(canSetPlayerPhoto(clubAdminA, CLUB_A, "p1")).toBe(false);
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
// 11 — show_player_photos_to_players=false hides photos (Phase 3 regression)
// ---------------------------------------------------------------------------
describe("player photo visibility setting", () => {
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
    expect(playerSafePlayer(player, { showPhotos: false }).photoUrl).toBeNull();
    expect(playerSafePlayer(player).photoUrl).toBeNull();
  });
  it("shows the proxy URL when the setting is on", () => {
    expect(playerSafePlayer(player, { showPhotos: true }).photoUrl).toBe("/api/files/abc");
  });
});
