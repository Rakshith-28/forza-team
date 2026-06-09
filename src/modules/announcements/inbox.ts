import "server-only";

import type { AuthContext } from "@/lib/rbac";
import { getMyUnreadClubAnnouncementCount, listMyRecentClubAnnouncements } from "@/modules/comms/service";
import {
  getMyPlatformAnnouncements,
  getMyUnreadPlatformAnnouncementCount,
} from "@/modules/announcements/platform-service";
import { countMyUnreadRemarkNotifications, listMyRemarkNotifications } from "@/modules/remarks/service";

/**
 * Combined notifications inbox for the navbar bell: platform broadcasts, the
 * caller's club announcements, and private coach remarks — unified for the
 * unread badge and dropdown. Remarks ride here ONLY; they never appear on the
 * /announcements page.
 */
export interface InboxItem {
  id: string;
  source: "platform" | "club" | "remark";
  title: string;
  severity: string | null;
  read: boolean;
  date: Date | null;
}

/** Combined unread count (platform + club + remarks) for the bell badge. */
export async function getMyAnnouncementsUnreadCount(ctx: AuthContext): Promise<number> {
  const [platform, club, remarks] = await Promise.all([
    getMyUnreadPlatformAnnouncementCount(ctx),
    getMyUnreadClubAnnouncementCount(ctx),
    countMyUnreadRemarkNotifications(ctx),
  ]);
  return platform + club + remarks;
}

/** Merged recent items (unread first, then newest), capped for the dropdown. */
export async function getMyAnnouncementInbox(ctx: AuthContext): Promise<InboxItem[]> {
  const [platform, club, remarks] = await Promise.all([
    getMyPlatformAnnouncements(ctx),
    listMyRecentClubAnnouncements(ctx, 10),
    listMyRemarkNotifications(ctx, 10),
  ]);
  const items: InboxItem[] = [
    ...platform.slice(0, 10).map((p) => ({
      id: p.id,
      source: "platform" as const,
      title: p.title,
      severity: p.severity,
      read: p.read,
      date: p.publishedAt,
    })),
    ...club.map((c) => ({
      id: c.id,
      source: "club" as const,
      title: c.title,
      severity: null,
      read: c.read,
      date: c.publishedAt,
    })),
    ...remarks.map((r) => ({
      id: r.id,
      source: "remark" as const,
      title: r.title,
      severity: null,
      read: r.read,
      date: r.date,
    })),
  ];
  items.sort((a, b) => Number(a.read) - Number(b.read) || (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  return items.slice(0, 12);
}
