import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/db/client";
import type { AuthContext } from "@/lib/rbac";
import {
  createPlatformAnnouncement,
  dismissPlatformAnnouncement,
  getMyPlatformAnnouncements,
  getMyUnreadPlatformAnnouncementCount,
  markPlatformAnnouncementRead,
} from "@/modules/announcements/platform-service";
import type { PlatformAnnouncementInput } from "@/modules/announcements/platform-schemas";

import { INTEGRATION, uid } from "./helpers";

/**
 * Platform-announcement visibility + read tracking (gated on TEST_DATABASE_URL):
 * ALL_CLUBS reaches every club; SPECIFIC_CLUBS only the targeted club; role
 * targeting respected; scheduled-future and expired excluded; read/dismiss write
 * a single row.
 */

function master(): AuthContext {
  return { userId: ids.master, role: "MASTER_ADMIN", activeClubId: null, coachTeamIds: [], coachTeamPlayerIds: [], linkedPlayerIds: [], childTeamIds: [] };
}
function clubAdmin(clubId: string, userId: string): AuthContext {
  return { userId, role: "CLUB_ADMIN", activeClubId: clubId, coachTeamIds: [], coachTeamPlayerIds: [], linkedPlayerIds: [], childTeamIds: [] };
}

const ids = { master: uid(), clubA: uid(), clubB: uid(), adminA: uid(), adminB: uid() };
const annIds: string[] = [];

const baseInput = (over: Partial<PlatformAnnouncementInput>): PlatformAnnouncementInput => ({
  title: "T",
  body: "B",
  severity: "INFO",
  audienceScope: "ALL_CLUBS",
  audienceRoles: ["CLUB_ADMIN"],
  clubIds: [],
  scheduledAt: null,
  expiresAt: null,
  pinned: false,
  publishNow: true,
  ...over,
});

const run = INTEGRATION ? describe : describe.skip;

run("platform announcement visibility", () => {
  beforeAll(async () => {
    await prisma.club.createMany({
      data: [
        { id: ids.clubA, name: "PA Club A", shortCode: `PAA-${ids.clubA.slice(0, 6)}` },
        { id: ids.clubB, name: "PA Club B", shortCode: `PAB-${ids.clubB.slice(0, 6)}` },
      ],
    });
  });

  afterAll(async () => {
    await prisma.platformAnnouncementRead.deleteMany({ where: { platformAnnouncementId: { in: annIds } } });
    await prisma.platformAnnouncementClub.deleteMany({ where: { platformAnnouncementId: { in: annIds } } });
    await prisma.platformAnnouncement.deleteMany({ where: { id: { in: annIds } } });
    await prisma.club.deleteMany({ where: { id: { in: [ids.clubA, ids.clubB] } } });
    await prisma.$disconnect();
  });

  it("ALL_CLUBS reaches every club; SPECIFIC_CLUBS only the targeted club; role + schedule/expiry respected", async () => {
    const all = await createPlatformAnnouncement(master(), baseInput({ title: "All" }));
    const specificA = await createPlatformAnnouncement(master(), baseInput({ title: "OnlyA", audienceScope: "SPECIFIC_CLUBS", clubIds: [ids.clubA] }));
    const coachOnly = await createPlatformAnnouncement(master(), baseInput({ title: "Coaches", audienceRoles: ["COACH"] }));
    const scheduled = await createPlatformAnnouncement(master(), baseInput({ title: "Future", publishNow: false, scheduledAt: new Date(Date.now() + 86400000) }));
    const expired = await createPlatformAnnouncement(master(), baseInput({ title: "Expired", expiresAt: new Date(Date.now() - 86400000) }));
    annIds.push(all, specificA, coachOnly, scheduled, expired);

    const aMine = await getMyPlatformAnnouncements(clubAdmin(ids.clubA, ids.adminA));
    const aTitles = aMine.map((m) => m.title);
    expect(aTitles).toContain("All"); // ALL_CLUBS reaches club A
    expect(aTitles).toContain("OnlyA"); // targeted at club A
    expect(aTitles).not.toContain("Coaches"); // role not targeted
    expect(aTitles).not.toContain("Future"); // scheduled in the future
    expect(aTitles).not.toContain("Expired"); // past expiry

    const bMine = await getMyPlatformAnnouncements(clubAdmin(ids.clubB, ids.adminB));
    const bTitles = bMine.map((m) => m.title);
    expect(bTitles).toContain("All"); // ALL_CLUBS reaches club B too
    expect(bTitles).not.toContain("OnlyA"); // NOT targeted at club B
  });

  it("read/dismiss write exactly one row and update the unread count", async () => {
    const ctx = clubAdmin(ids.clubA, ids.adminA);
    const target = annIds[0]; // the ALL_CLUBS announcement

    const before = await getMyUnreadPlatformAnnouncementCount(ctx);
    await markPlatformAnnouncementRead(ctx, target);
    await markPlatformAnnouncementRead(ctx, target); // idempotent — must not duplicate
    const rows = await prisma.platformAnnouncementRead.findMany({ where: { platformAnnouncementId: target, userId: ids.adminA } });
    expect(rows).toHaveLength(1);
    expect(rows[0].readAt).not.toBeNull();

    const after = await getMyUnreadPlatformAnnouncementCount(ctx);
    expect(after).toBe(before - 1);

    await dismissPlatformAnnouncement(ctx, target);
    const afterDismiss = await prisma.platformAnnouncementRead.findMany({ where: { platformAnnouncementId: target, userId: ids.adminA } });
    expect(afterDismiss).toHaveLength(1); // still one row
    expect(afterDismiss[0].dismissedAt).not.toBeNull();
  });
});
