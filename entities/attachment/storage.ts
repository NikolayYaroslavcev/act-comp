import fs from "node:fs";
import path from "node:path";

export interface AttachmentBlobStore {
  write(taskId: string, attachmentId: string, bytes: Uint8Array): void;
  read(taskId: string, attachmentId: string): Uint8Array | undefined;
  remove(taskId: string, attachmentId: string): void;
}

/**
 * Binary bytes live outside `db.json`, keyed only by server-generated ids
 * (never the client's original filename), so a path is always
 * `<baseDir>/<taskId>/<attachmentId>` with no user-controlled path segment.
 */
export function createFileAttachmentBlobStore(baseDir: string): AttachmentBlobStore {
  function filePath(taskId: string, attachmentId: string): string {
    return path.join(baseDir, taskId, attachmentId);
  }

  return {
    write(taskId, attachmentId, bytes) {
      const target = filePath(taskId, attachmentId);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
    },
    read(taskId, attachmentId) {
      try {
        return new Uint8Array(fs.readFileSync(filePath(taskId, attachmentId)));
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return undefined;
        }
        throw error;
      }
    },
    remove(taskId, attachmentId) {
      try {
        fs.unlinkSync(filePath(taskId, attachmentId));
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return;
        }
        throw error;
      }
    },
  };
}

/** Pure in-memory store, used under Vitest to keep tests fast, isolated, and disk-free (mirrors createMemoryDbStore in shared/lib/db.ts). */
export function createMemoryAttachmentBlobStore(): AttachmentBlobStore {
  const files = new Map<string, Uint8Array>();
  const key = (taskId: string, attachmentId: string) => `${taskId}/${attachmentId}`;

  return {
    write(taskId, attachmentId, bytes) {
      files.set(key(taskId, attachmentId), bytes);
    },
    read(taskId, attachmentId) {
      return files.get(key(taskId, attachmentId));
    },
    remove(taskId, attachmentId) {
      files.delete(key(taskId, attachmentId));
    },
  };
}

const DEFAULT_ATTACHMENTS_DIR = path.join(process.cwd(), ".local-state", "attachments");

const blobStore: AttachmentBlobStore = process.env.VITEST
  ? createMemoryAttachmentBlobStore()
  : createFileAttachmentBlobStore(DEFAULT_ATTACHMENTS_DIR);

export function writeAttachmentBlob(taskId: string, attachmentId: string, bytes: Uint8Array): void {
  blobStore.write(taskId, attachmentId, bytes);
}

export function readAttachmentBlob(taskId: string, attachmentId: string): Uint8Array | undefined {
  return blobStore.read(taskId, attachmentId);
}

export function removeAttachmentBlob(taskId: string, attachmentId: string): void {
  blobStore.remove(taskId, attachmentId);
}
