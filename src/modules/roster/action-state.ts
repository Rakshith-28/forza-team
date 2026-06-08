/**
 * Shared form-action state for the roster module. Kept out of actions.ts because
 * a "use server" file may only export async functions (not types or constants).
 */
export interface FormState {
  ok: boolean;
  error: string | null;
  /** Soft warning on an otherwise-successful action (e.g. invite saved but email not sent). */
  notice?: string | null;
  /** Accept link for a freshly created invite — surfaced so it can be copied/shared manually. */
  acceptUrl?: string | null;
}

export const INITIAL_STATE: FormState = { ok: false, error: null };
