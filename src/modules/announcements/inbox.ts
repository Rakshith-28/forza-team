import "server-only";

import type { AuthContext } from "@/lib/rbac";
import { getMyUnreadClubAnnouncementCount, listMyRecentClubAnnouncements } from "@/modules/comms/service";
import {
  getMyPlatformAnnouncements,
  getMyUnreadPlatformAnnouncementCount,
} from "@/modules/announcements/platform-service";

/**
 * Combined announcements inbox for the navbar bell: platform broadcasts + the
 * caller's club announcements, unified for the unread badge and dropdown.
 */
export interface InboxItem {
  id: string;
  source: "platform" | "club";
  title: string;
  severity: string | null;
  read: boolean;
  date: Date | null;
}

/** Combined unread count (platform + club) for the bell badge. */
export async function getMyAnnouncementsUnreadCount(ctx: AuthContext): Promise<number> {
  const [platform, club] = await Promise.all([
    getMyUnreadPlatformAnnouncementCount(ctx),
    getMyUnreadClubAnnouncementCount(ctx),
  ]);
  return platform + club;
}

/** Merged recent items (unread first, then newest), capped for the dropdown. */
export async function getMyAnnouncementInbox(ctx: AuthContext): Promise<InboxItem[]> {
  const [platform, club] = await Promise.all([
    getMyPlatformAnnouncements(ctx),
    listMyRecentClubAnnouncements(ctx, 10),
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
  ];
  items.sort((a, b) => Number(a.read) - Number(b.read) || (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  return items.slice(0, 12);
}
