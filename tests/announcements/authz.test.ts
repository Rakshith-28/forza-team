import { describe, expect, it } from "vitest";

import { ForbiddenError, type AuthContext } from "@/lib/rbac";
import {
  archivePlatformAnnouncement,
  createPlatformAnnouncement,
  createPlatformTemplate,
  deletePlatformAnnouncement,
  deletePlatformTemplate,
  duplicatePlatformAnnouncement,
  getPlatformAnnouncementDetail,
  getPlatformAnnouncements,
  getPlatformAnnouncementsSummary,
  listPlatformTemplates,
  publishPlatformAnnouncement,
  updatePlatformAnnouncement,
  updatePlatformTemplate,
} from "@/modules/announcements/platform-service";
import {
  platformAnnouncementInputSchema,
  type PlatformAnnouncementInput,
  type PlatformTemplateInput,
} from "@/modules/announcements/platform-schemas";

/**
 * Platform-announcement master authorization + composer validation. Every master
 * service asserts MASTER_ADMIN first (before DB), so non-master roles are
 * provably rejected without a database. DB-backed visibility/read behaviour lives
 * in tests-integration/platform-announcements.integration.test.ts.
 */

function ctx(role: AuthContext["role"]): AuthContext {
  return {
    userId: "u",
    role,
    activeClubId: "club-a",
    coachTeamIds: [],
    coachTeamPlayerIds: [],
    linkedPlayerIds: [],
    childTeamIds: [],
  };
}

const ANN: PlatformAnnouncementInput = {
  title: "Notice",
  body: "Body",
  severity: "INFO",
  audienceScope: "ALL_CLUBS",
  audienceRoles: ["CLUB_ADMIN"],
  clubIds: [],
  scheduledAt: null,
  expiresAt: null,
  pinned: false,
  publishNow: false,
};
const TPL: PlatformTemplateInput = {
  name: "T",
  title: "Notice",
  body: "Body",
  severity: "INFO",
  defaultAudienceScope: "ALL_CLUBS",
  defaultAudienceRoles: ["CLUB_ADMIN"],
};

describe("platform announcement master services reject non-master roles", () => {
  for (const role of ["CLUB_ADMIN", "COACH", "PLAYER"] as const) {
    it(`rejects ${role}`, async () => {
      const c = ctx(role);
      await expect(createPlatformAnnouncement(c, ANN)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(updatePlatformAnnouncement(c, "id", ANN)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(publishPlatformAnnouncement(c, "id")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(archivePlatformAnnouncement(c, "id")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(deletePlatformAnnouncement(c, "id")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(duplicatePlatformAnnouncement(c, "id")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getPlatformAnnouncements(c)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getPlatformAnnouncementDetail(c, "id")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getPlatformAnnouncementsSummary(c)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listPlatformTemplates(c)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(createPlatformTemplate(c, TPL)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(updatePlatformTemplate(c, "id", TPL)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(deletePlatformTemplate(c, "id")).rejects.toBeInstanceOf(ForbiddenError);
    });
  }
});

describe("composer validation", () => {
  function raw(over: Partial<PlatformAnnouncementInput> = {}) {
    return { ...ANN, ...over };
  }
  it("accepts a valid ALL_CLUBS announcement", () => {
    expect(platformAnnouncementInputSchema.safeParse(raw()).success).toBe(true);
  });
  it("requires a non-empty title and body", () => {
    expect(platformAnnouncementInputSchema.safeParse(raw({ title: "" })).success).toBe(false);
    expect(platformAnnouncementInputSchema.safeParse(raw({ body: "" })).success).toBe(false);
  });
  it("requires at least one club when scope is SPECIFIC_CLUBS", () => {
    expect(platformAnnouncementInputSchema.safeParse(raw({ audienceScope: "SPECIFIC_CLUBS", clubIds: [] })).success).toBe(false);
    const ok = platformAnnouncementInputSchema.safeParse(
      raw({ audienceScope: "SPECIFIC_CLUBS", clubIds: ["11111111-1111-4111-8111-111111111111"] }),
    );
    expect(ok.success).toBe(true);
  });
  it("requires at least one audience role", () => {
    expect(platformAnnouncementInputSchema.safeParse(raw({ audienceRoles: [] })).success).toBe(false);
  });
  it("rejects expiry before the scheduled time", () => {
    const scheduledAt = new Date(Date.now() + 2 * 86400000);
    const expiresAt = new Date(Date.now() + 86400000);
    expect(platformAnnouncementInputSchema.safeParse(raw({ scheduledAt, expiresAt })).success).toBe(false);
  });
});
