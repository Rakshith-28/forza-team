import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";

/**
 * Storage abstraction (BUILD_PLAN §1 — file storage). The rest of the app talks
 * to this interface only and NEVER to a concrete provider, so the backing store
 * is swappable. Storage keys are opaque internal handles; they are never
 * returned to clients — reads go through the permission-checked proxy at
 * /api/files/[id] (see src/modules/files/service.ts).
 *
 * Provider selection (env): `vercel-blob` when STORAGE_DRIVER=blob or a
 * BLOB_READ_WRITE_TOKEN is present (required on serverless Vercel, which has no
 * writable disk); otherwise local disk for dev. The proxy still authorizes every
 * read — blobs are stored at unguessable keys and never linked publicly.
 */
export interface PutInput {
  key: string;
  bytes: Buffer;
  contentType: string;
}

export interface StorageProvider {
  put(input: PutInput): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

const UPLOAD_ROOT = path.join(process.cwd(), ".uploads");

/** Local-disk provider. Keys map to files under .uploads/ (gitignored). */
class LocalDiskStorage implements StorageProvider {
  private resolve(key: string): string {
    // Keys are server-generated UUID-based names; reject path traversal anyway.
    const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    return path.join(UPLOAD_ROOT, safe);
  }

  async put({ key, bytes }: PutInput): Promise<void> {
    const dest = this.resolve(key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, bytes);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

/**
 * Vercel Blob provider (production). Blobs are written at our opaque key with no
 * random suffix so the key round-trips; reads fetch the blob's download URL
 * server-side and stream through the proxy — the URL is never handed to clients.
 */
class VercelBlobStorage implements StorageProvider {
  constructor(private readonly token: string) {}

  async put({ key, bytes, contentType }: PutInput): Promise<void> {
    const { put } = await import("@vercel/blob");
    await put(key, bytes, {
      access: "public",
      token: this.token,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }

  async get(key: string): Promise<Buffer | null> {
    const { head } = await import("@vercel/blob");
    try {
      const info = await head(key, { token: this.token });
      const res = await fetch(info.downloadUrl);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null; // BlobNotFoundError etc.
    }
  }

  async delete(key: string): Promise<void> {
    const { del } = await import("@vercel/blob");
    await del(key, { token: this.token });
  }
}

let provider: StorageProvider | null = null;

/** The active storage provider (memoized), chosen by env. */
export function getStorage(): StorageProvider {
  if (provider) return provider;
  const useBlob = env.STORAGE_DRIVER === "blob" || (!env.STORAGE_DRIVER && !!env.BLOB_READ_WRITE_TOKEN);
  if (useBlob) {
    if (!env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("STORAGE_DRIVER=blob requires BLOB_READ_WRITE_TOKEN");
    }
    provider = new VercelBlobStorage(env.BLOB_READ_WRITE_TOKEN);
  } else {
    provider = new LocalDiskStorage();
  }
  return provider;
}
