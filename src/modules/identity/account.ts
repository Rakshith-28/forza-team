import "server-only";

import { prisma } from "@/db/client";
import type { AuthContext } from "@/lib/rbac";

/**
 * Self-service account profile + notification preferences. Operates only on the
 * caller's own record (ctx.userId) — no cross-user access, no audit needed.
 */

export interface NotificationPrefs {
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  chatNotificationsEnabled: boolean;
  announcementNotificationsEnabled: boolean;
  billingNotificationsEnabled: boolean;
  scheduleNotificationsEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  emailEnabled: true,
  pushEnabled: true,
  smsEnabled: false,
  chatNotificationsEnabled: true,
  announcementNotificationsEnabled: true,
  billingNotificationsEnabled: true,
  scheduleNotificationsEnabled: true,
};

export interface MyAccount {
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  notifications: NotificationPrefs;
}

export async function getMyAccount(ctx: AuthContext): Promise<MyAccount> {
  const [user, prefs] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { name: true, email: true, firstName: true, lastName: true, phone: true },
    }),
    prisma.notificationPreference.findUnique({
      where: { userId: ctx.userId },
      select: {
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: true,
        chatNotificationsEnabled: true,
        announcementNotificationsEnabled: true,
        billingNotificationsEnabled: true,
        scheduleNotificationsEnabled: true,
      },
    }),
  ]);
  return {
    name: user.name ?? `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    notifications: prefs ?? DEFAULT_PREFS,
  };
}

export interface UpdateMyAccountInput {
  phone: string | null;
  notifications: NotificationPrefs;
}

export async function updateMyAccount(ctx: AuthContext, input: UpdateMyAccountInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: ctx.userId }, data: { phone: input.phone, updatedAt: new Date() } });
    await tx.notificationPreference.upsert({
      where: { userId: ctx.userId },
      create: { userId: ctx.userId, ...input.notifications },
      update: { ...input.notifications, updatedAt: new Date() },
    });
  });
}
