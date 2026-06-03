"use server";

import { revalidatePath } from "next/cache";

import { requireUserAndContext } from "@/lib/auth-guards";
import { ForbiddenError } from "@/lib/rbac";
import type { FormState } from "@/modules/files/action-state";
import { UploadValidationError } from "@/modules/files/schemas";
import {
  deleteClubDocument,
  deleteTeamDocument,
  uploadClubDocument,
  uploadPlayerPhoto,
  uploadTeamDocument,
  type UploadFileInput,
} from "@/modules/files/service";

function failService(error: unknown): FormState {
  if (error instanceof ForbiddenError) return { ok: false, error: "You don't have access to do that." };
  if (error instanceof UploadValidationError) return { ok: false, error: error.message };
  throw error;
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

/** Read a FormData File field into the service's upload input, or null if absent. */
async function readFile(fd: FormData, key: string): Promise<UploadFileInput | null> {
  const f = fd.get(key);
  if (!(f instanceof File) || f.size === 0) return null;
  const bytes = Buffer.from(await f.arrayBuffer());
  return { bytes, originalName: f.name, mimeType: f.type, size: f.size };
}

export async function uploadPlayerPhotoAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const playerId = str(fd, "playerId");
  const file = await readFile(fd, "file");
  if (!file) return { ok: false, error: "Choose an image to upload." };
  try {
    await uploadPlayerPhoto(ctx, playerId, file);
  } catch (e) {
    return failService(e);
  }
  revalidatePath(`/players/${playerId}`);
  revalidatePath(`/my-kids/${playerId}`);
  return { ok: true, error: null };
}

export async function uploadClubDocumentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  if (!ctx.activeClubId) return { ok: false, error: "No active club." };
  const file = await readFile(fd, "file");
  if (!file) return { ok: false, error: "Choose a file to upload." };
  try {
    await uploadClubDocument(ctx, ctx.activeClubId, file);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/documents");
  return { ok: true, error: null };
}

export async function deleteClubDocumentAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  await deleteClubDocument(ctx, str(fd, "fileId"));
  revalidatePath("/documents");
}

export async function uploadTeamDocumentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { ctx } = await requireUserAndContext();
  const teamId = str(fd, "teamId");
  const file = await readFile(fd, "file");
  if (!file) return { ok: false, error: "Choose a file to upload." };
  try {
    await uploadTeamDocument(ctx, teamId, file);
  } catch (e) {
    return failService(e);
  }
  revalidatePath("/documents");
  return { ok: true, error: null };
}

export async function deleteTeamDocumentAction(fd: FormData): Promise<void> {
  const { ctx } = await requireUserAndContext();
  await deleteTeamDocument(ctx, str(fd, "fileId"));
  revalidatePath("/documents");
}
