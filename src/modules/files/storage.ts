import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Storage abstraction (BUILD_PLAN §1 — file storage). The rest of the app talks
 * to this interface only and NEVER to a concrete provider, so the backing store
 * is swappable. Storage keys are opaque internal handles; they are never
 * returned to clients — reads go through the permission-checked proxy at
 * /api/files/[id] (see src/modules/files/service.ts).
 *
 * Default provider: local disk (works in dev and on a single node). A Vercel
 * Blob or S3-compatible provider implementing this same interface is a drop-in
 * replacement for production — no call site changes required.
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

let provider: StorageProvider | null = null;

/** The active storage provider (memoized). Swap the impl here to change backends. */
export function getStorage(): StorageProvider {
  provider ??= new LocalDiskStorage();
  return provider;
}
