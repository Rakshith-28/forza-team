import "server-only";

import { prisma } from "@/db/client";
import { toAppearanceTheme, type AppearanceTheme } from "@/lib/appearance";

/**
 * Read/write the signed-in user's player/parent appearance theme. Persisted on
 * the user record so it follows them across devices; read server-side by the
 * parent app shell to set data-theme on the initial render (no flash).
 */
export async function getAppearanceTheme(userId: string): Promise<AppearanceTheme> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { appearanceTheme: true },
  });
  return toAppearanceTheme(user?.appearanceTheme);
}

export async function setAppearanceTheme(userId: string, theme: AppearanceTheme): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { appearanceTheme: theme, updatedAt: new Date() },
  });
}
