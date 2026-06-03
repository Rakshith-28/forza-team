/**
 * Shared form-action state for the roster module. Kept out of actions.ts because
 * a "use server" file may only export async functions (not types or constants).
 */
export interface FormState {
  ok: boolean;
  error: string | null;
}

export const INITIAL_STATE: FormState = { ok: false, error: null };
