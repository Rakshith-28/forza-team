/**
 * Upload validation rules for the files module. Validation runs server-side
 * before anything is stored (MIME + extension + size), in addition to the
 * scope/ownership checks in the service layer.
 *
 * TEAM_DOCUMENT is intentionally NOT a purpose here: the `files` table has no
 * team_id column, so team-scoped sharing rides on team-chat attachments instead
 * (see the Phase 4 summary — flagged schema gap, deferred rather than migrated
 * against an unreachable DB on an unsupported Node).
 */
export const FILE_PURPOSES = ["PLAYER_PHOTO", "CLUB_DOCUMENT", "CHAT_ATTACHMENT"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

interface PurposeRule {
  /** Allowed MIME types. */
  mimeTypes: readonly string[];
  /** Allowed lowercase extensions (with dot). */
  extensions: readonly string[];
  /** Max size in bytes. */
  maxBytes: number;
}

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"] as const;
const DOC_MIMES = ["application/pdf", "text/plain", "text/csv", ...IMAGE_MIMES] as const;
const DOC_EXTS = [".pdf", ".txt", ".csv", ...IMAGE_EXTS] as const;

export const FILE_RULES: Record<FilePurpose, PurposeRule> = {
  PLAYER_PHOTO: { mimeTypes: IMAGE_MIMES, extensions: IMAGE_EXTS, maxBytes: 5 * 1024 * 1024 },
  CLUB_DOCUMENT: { mimeTypes: DOC_MIMES, extensions: DOC_EXTS, maxBytes: 10 * 1024 * 1024 },
  CHAT_ATTACHMENT: { mimeTypes: DOC_MIMES, extensions: DOC_EXTS, maxBytes: 10 * 1024 * 1024 },
};

export class UploadValidationError extends Error {
  readonly code = "UPLOAD_INVALID";
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export interface UploadCandidate {
  originalName: string;
  mimeType: string;
  size: number;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

/**
 * Validates an upload against its purpose. Throws UploadValidationError on any
 * disallowed MIME, extension, or oversize file. Returns the normalized
 * extension for key generation.
 */
export function validateUpload(purpose: FilePurpose, file: UploadCandidate): string {
  const rule = FILE_RULES[purpose];
  if (file.size <= 0) throw new UploadValidationError("File is empty");
  if (file.size > rule.maxBytes) {
    throw new UploadValidationError(`File exceeds the ${Math.round(rule.maxBytes / (1024 * 1024))}MB limit`);
  }
  if (!rule.mimeTypes.includes(file.mimeType)) {
    throw new UploadValidationError(`Unsupported file type: ${file.mimeType || "unknown"}`);
  }
  const ext = extensionOf(file.originalName);
  if (!rule.extensions.includes(ext)) {
    throw new UploadValidationError(`Unsupported file extension: ${ext || "none"}`);
  }
  return ext;
}
