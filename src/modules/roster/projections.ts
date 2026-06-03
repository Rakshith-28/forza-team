/**
 * Parent-safe roster projection (RBAC matrix §6.8 / §7.1, BUILD_PLAN §2).
 *
 * When a PARENT views OTHER children on a linked child's team, they may only
 * ever see the safe fields below. Every restricted field (DOB, medical,
 * emergency contacts, address, evaluations, internal notes, contact info, …)
 * is stripped HERE, in the data layer — never relying on the UI to hide it.
 */

/** The full set of player fields this projection reads from (input shape). */
export interface PlayerLike {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  jerseyNumber: string | null;
  primaryPosition: string | null;
  photoUrl: string | null;
  // — restricted fields below are intentionally never copied out —
  dateOfBirth?: unknown;
  medicalNotes?: unknown;
  allergyNotes?: unknown;
  emergencyContactName?: unknown;
  emergencyContactPhone?: unknown;
}

/** The ONLY fields a parent may see for another family's child. */
export interface SafePlayer {
  id: string;
  displayName: string;
  preferredName: string | null;
  jerseyNumber: string | null;
  primaryPosition: string | null;
  /** Present only when the club setting allows showing photos to parents. */
  photoUrl: string | null;
}

export interface ParentSafeOptions {
  /** ClubSetting.showPlayerPhotosToParents — default false (safest). */
  showPhotos?: boolean;
}

export function parentSafePlayer(player: PlayerLike, options: ParentSafeOptions = {}): SafePlayer {
  return {
    id: player.id,
    displayName: player.preferredName ?? `${player.firstName} ${player.lastName}`,
    preferredName: player.preferredName,
    jerseyNumber: player.jerseyNumber,
    primaryPosition: player.primaryPosition,
    photoUrl: options.showPhotos ? player.photoUrl : null,
  };
}

export function parentSafeRoster(players: PlayerLike[], options: ParentSafeOptions = {}): SafePlayer[] {
  return players.map((p) => parentSafePlayer(p, options));
}
