"use server";

import { requireAuthContext } from "@/lib/auth-guards";
import { markClubAnnouncementRead } from "@/modules/comms/service";
import { getMyAnnouncementInbox, type InboxItem } from "@/modules/announcements/inbox";
import { markPlatformAnnouncementRead } from "@/modules/announcements/platform-service";
import { markRemarkNotificationRead } from "@/modules/remarks/service";

/** Lazy-load the bell dropdown contents. */
export async function loadAnnouncementInboxAction(): Promise<InboxItem[]> {
  const ctx = await requireAuthContext();
  return getMyAnnouncementInbox(ctx);
}

/** Mark a bell item read (platform, club, or coach remark). Best-effort. */
export async function markInboxItemReadAction(source: InboxItem["source"], id: string): Promise<void> {
  const ctx = await requireAuthContext();
  try {
    if (source === "platform") await markPlatformAnnouncementRead(ctx, id);
    else if (source === "club") await markClubAnnouncementRead(ctx, id);
    else await markRemarkNotificationRead(ctx, id);
  } catch {
    /* not visible / already gone — ignore */
  }
}
