"use server";

import { requireAuthContext } from "@/lib/auth-guards";
import { markClubAnnouncementRead } from "@/modules/comms/service";
import { getMyAnnouncementInbox, type InboxItem } from "@/modules/announcements/inbox";
import { markPlatformAnnouncementRead } from "@/modules/announcements/platform-service";

/** Lazy-load the bell dropdown contents. */
export async function loadAnnouncementInboxAction(): Promise<InboxItem[]> {
  const ctx = await requireAuthContext();
  return getMyAnnouncementInbox(ctx);
}

/** Mark a bell item read (platform or club). Best-effort — failures are swallowed. */
export async function markInboxItemReadAction(source: "platform" | "club", id: string): Promise<void> {
  const ctx = await requireAuthContext();
  try {
    if (source === "platform") await markPlatformAnnouncementRead(ctx, id);
    else await markClubAnnouncementRead(ctx, id);
  } catch {
    /* not visible / already gone — ignore */
  }
}
