import { z } from "zod";

/**
 * Zod schemas for the roster module (players, player accounts, account↔child
 * links, team memberships). Shared between client forms and server actions/services —
 * the service layer never trusts client input (BUILD_PLAN §5). Enum-like values
 * mirror the controlled strings in docs/soccer_club_database_schema.md.
 */

// --- Controlled vocabularies ----------------------------------------------
export const PLAYER_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const MEMBERSHIP_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export const PLAYER_POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;
export const PLAYER_POSITION_LABELS: Record<(typeof PLAYER_POSITIONS)[number], string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

export const RELATIONSHIP_TYPES = ["MOTHER", "FATHER", "GUARDIAN", "OTHER"] as const;
export const RELATIONSHIP_LABELS: Record<(typeof RELATIONSHIP_TYPES)[number], string> = {
  MOTHER: "Mother",
  FATHER: "Father",
  GUARDIAN: "Guardian",
  OTHER: "Other",
};

export const CONTACT_METHODS = ["EMAIL", "PHONE", "SMS"] as const;

// --- Reusable field fragments ---------------------------------------------
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

const position = z.enum(PLAYER_POSITIONS).optional().or(z.literal("").transform(() => undefined));

// --- Players ---------------------------------------------------------------
export const createPlayerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  preferredName: optionalText(100),
  dateOfBirth: z.coerce.date().optional().nullable().catch(null),
  jerseyNumber: optionalText(20),
  primaryPosition: position,
  secondaryPosition: position,
  photoUrl: optionalText(2048),
  medicalNotes: optionalText(4000),
  allergyNotes: optionalText(4000),
  emergencyContactName: optionalText(200),
  emergencyContactPhone: optionalText(30),
  // Optional initial team placement (required for COACH-created players —
  // enforced in the service layer, since coaches may only act on their teams).
  initialTeamId: z.string().uuid().optional().nullable(),
  initialSeasonId: z.string().uuid().optional().nullable(),
});
export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;

export const updatePlayerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  preferredName: optionalText(100),
  dateOfBirth: z.coerce.date().optional().nullable().catch(null),
  jerseyNumber: optionalText(20),
  primaryPosition: position,
  secondaryPosition: position,
  photoUrl: optionalText(2048),
  medicalNotes: optionalText(4000),
  allergyNotes: optionalText(4000),
  emergencyContactName: optionalText(200),
  emergencyContactPhone: optionalText(30),
  status: z.enum(PLAYER_STATUSES),
});
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;

/**
 * The ONLY player fields a PLAYER account may edit on their own linked child
 * (RBAC matrix §6.6 "approved fields only"). Centralized + auditable; anything
 * outside this set is rejected server-side. Coach/admin-owned fields
 * (jerseyNumber, positions, status, memberships, links) are deliberately absent.
 */
export const PLAYER_ACCOUNT_EDITABLE_PLAYER_FIELDS = [
  "preferredName",
  "photoUrl",
  "emergencyContactName",
  "emergencyContactPhone",
  "medicalNotes",
  "allergyNotes",
] as const;

export type PlayerAccountEditablePlayerField = (typeof PLAYER_ACCOUNT_EDITABLE_PLAYER_FIELDS)[number];

/**
 * Strict schema for a player account editing their own child. `.strict()` makes
 * the presence of ANY non-whitelisted key (e.g. jerseyNumber, status) a parse
 * failure — the first line of defense before the service whitelist filter.
 */
export const playerAccountUpdatePlayerSchema = z
  .object({
    preferredName: optionalText(100),
    photoUrl: optionalText(2048),
    emergencyContactName: optionalText(200),
    emergencyContactPhone: optionalText(30),
    medicalNotes: optionalText(4000),
    allergyNotes: optionalText(4000),
  })
  .strict();
export type PlayerAccountUpdatePlayerInput = z.infer<typeof playerAccountUpdatePlayerSchema>;

// --- Player accounts -------------------------------------------------------
/**
 * Coach/admin invites a player account FOR a specific player (no name fields —
 * collected at accept). The link metadata is carried on the invitation and
 * applied as a player_account_link on acceptance.
 */
export const invitePlayerAccountForPlayerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email required").max(255),
  playerId: z.string().uuid(),
  relationshipType: z.enum(RELATIONSHIP_TYPES),
  isPrimaryGuardian: z.coerce.boolean().optional(),
  canPickup: z.coerce.boolean().optional(),
  canPay: z.coerce.boolean().optional(),
});
export type InvitePlayerAccountForPlayerInput = z.infer<typeof invitePlayerAccountForPlayerSchema>;

export const updatePlayerAccountSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  phone: optionalText(30),
  secondaryPhone: optionalText(30),
  preferredContactMethod: z.enum(CONTACT_METHODS).optional().or(z.literal("").transform(() => undefined)),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(100),
  state: optionalText(100),
  postalCode: optionalText(20),
});
export type UpdatePlayerAccountInput = z.infer<typeof updatePlayerAccountSchema>;

// --- Player account ↔ player links -----------------------------------------
export const linkPlayerAccountSchema = z.object({
  playerId: z.string().uuid(),
  playerAccountId: z.string().uuid(),
  relationshipType: z.enum(RELATIONSHIP_TYPES),
  isPrimaryGuardian: z.coerce.boolean().optional(),
  canPickup: z.coerce.boolean().optional(),
  canPay: z.coerce.boolean().optional(),
});
export type LinkPlayerAccountInput = z.infer<typeof linkPlayerAccountSchema>;

// --- Player ↔ team memberships ---------------------------------------------
export const addMembershipSchema = z.object({
  playerId: z.string().uuid(),
  teamId: z.string().uuid(),
  seasonId: z.string().uuid().optional().nullable(),
});
export type AddMembershipInput = z.infer<typeof addMembershipSchema>;
