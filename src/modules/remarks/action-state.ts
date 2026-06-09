/**
 * Shared form-action state for the remarks module. Kept out of actions.ts
 * because a "use server" file may only export async functions.
 */
export interface FormState {
  ok: boolean;
  error: string | null;
}

export const INITIAL_STATE: FormState = { ok: false, error: null };
