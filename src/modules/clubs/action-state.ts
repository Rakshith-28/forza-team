/**
 * Shared form-action state. Kept out of actions.ts because a "use server" file
 * may only export async functions (not types or constants).
 */
export interface FormState {
  ok: boolean;
  error: string | null;
}

export const INITIAL_STATE: FormState = { ok: false, error: null };

/** Club-create result state — carries the optional initial-admin invite outcome. */
export interface CreateClubState extends FormState {
  invite: { acceptUrl: string; emailDelivered: boolean; email: string } | null;
}

export const CREATE_CLUB_INITIAL: CreateClubState = { ok: false, error: null, invite: null };
