import fs from "node:fs";
import path from "node:path";
import { put, get, del } from "@vercel/blob";

export interface AttachmentBlobStore {
  write(taskId: string, attachmentId: string, bytes: Uint8Array): Promise<void>;
  read(taskId: string, attachmentId: string): Promise<Uint8Array | undefined>;
  remove(taskId: string, attachmentId: string): Promise<void>;
}

/**
 * Binary bytes live outside `db.json`, keyed only by server-generated ids
 * (never the client's original filename), so a path is always
 * `<baseDir>/<taskId>/<attachmentId>` with no user-controlled path segment.
 *
 * Only usable on a host with a persistent, shared filesystem — see
 * `createBlobAttachmentBlobStore` for serverless deployments.
 */
export function createFileAttachmentBlobStore(baseDir: string): AttachmentBlobStore {
  function filePath(taskId: string, attachmentId: string): string {
    return path.join(baseDir, taskId, attachmentId);
  }

  return {
    async write(taskId, attachmentId, bytes) {
      const target = filePath(taskId, attachmentId);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
    },
    async read(taskId, attachmentId) {
      try {
        return new Uint8Array(fs.readFileSync(filePath(taskId, attachmentId)));
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return undefined;
        }
        throw error;
      }
    },
    async remove(taskId, attachmentId) {
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

/**
 * Vercel Blob-backed attachment store, for serverless deployments where each
 * function invocation gets its own ephemeral filesystem. One private blob
 * per attachment, at the same `<taskId>/<attachmentId>` pathname the file
 * store uses, keeping the no-user-controlled-path-segment guarantee.
 */
export function createBlobAttachmentBlobStore(): AttachmentBlobStore {
  function pathname(taskId: string, attachmentId: string): string {
    return `attachments/${taskId}/${attachmentId}`;
  }

  return {
    async write(taskId, attachmentId, bytes) {
      await put(pathname(taskId, attachmentId), Buffer.from(bytes), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/octet-stream",
      });
    },
    async read(taskId, attachmentId) {
      const result = await get(pathname(taskId, attachmentId), { access: "private" });
      if (!result || result.statusCode !== 200) {
        return undefined;
      }
      return new Uint8Array(await new Response(result.stream).arrayBuffer());
    },
    async remove(taskId, attachmentId) {
      await del(pathname(taskId, attachmentId));
    },
  };
}

/** Pure in-memory store, used under Vitest to keep tests fast, isolated, and disk-free (mirrors createMemoryDbStore in shared/lib/db.ts). */
export function createMemoryAttachmentBlobStore(): AttachmentBlobStore {
  const files = new Map<string, Uint8Array>();
  const key = (taskId: string, attachmentId: string) => `${taskId}/${attachmentId}`;

  return {
    async write(taskId, attachmentId, bytes) {
      files.set(key(taskId, attachmentId), bytes);
    },
    async read(taskId, attachmentId) {
      return files.get(key(taskId, attachmentId));
    },
    async remove(taskId, attachmentId) {
      files.delete(key(taskId, attachmentId));
    },
  };
}

const DEFAULT_ATTACHMENTS_DIR = path.join(process.cwd(), ".local-state", "attachments");

function createAttachmentBlobStore(): AttachmentBlobStore {
  if (process.env.VITEST) {
    return createMemoryAttachmentBlobStore();
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return createBlobAttachmentBlobStore();
  }
  return createFileAttachmentBlobStore(DEFAULT_ATTACHMENTS_DIR);
}

const blobStore: AttachmentBlobStore = createAttachmentBlobStore();

export function writeAttachmentBlob(taskId: string, attachmentId: string, bytes: Uint8Array): Promise<void> {
  return blobStore.write(taskId, attachmentId, bytes);
}

export function readAttachmentBlob(taskId: string, attachmentId: string): Promise<Uint8Array | undefined> {
  return blobStore.read(taskId, attachmentId);
}

export function removeAttachmentBlob(taskId: string, attachmentId: string): Promise<void> {
  return blobStore.remove(taskId, attachmentId);
}
