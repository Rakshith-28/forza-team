import { z } from "zod";

/**
 * One Zod schema for adding a coach remark, shared by the client form and the
 * server action. `parentVisible` rides in as a checkbox; absent ⇒ private.
 */
export const addRemarkSchema = z.object({
  playerId: z.string().uuid(),
  body: z.string().trim().min(1, "Write a remark").max(4000, "Remark is too long"),
  parentVisible: z.boolean().default(false),
});

export type AddRemarkInput = z.infer<typeof addRemarkSchema>;

/** Notification type + channel used for the bell-only delivery of shared remarks. */
export const COACH_REMARK_NOTIFICATION_TYPE = "COACH_REMARK";
export const IN_APP_CHANNEL = "IN_APP";
