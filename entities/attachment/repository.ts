import { getDb, saveDb } from "@/shared/lib/db";
import type { Database } from "@/entities/database/schema";
import type { Attachment } from "@/entities/attachment/schema";
import { readAttachmentBlob, removeAttachmentBlob, writeAttachmentBlob } from "@/entities/attachment/storage";
import { sanitizeAttachmentFilename } from "@/entities/attachment/model";

export interface CreateAttachmentParams {
  taskId: string;
  uploadedBy: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}

// Bytes are written before the metadata record so a crash between the two
// steps leaves, at worst, an orphan file with no metadata (invisible via
// every API, since lookups all go through db.attachments) — never orphan
// metadata pointing at bytes that don't exist.
export function createAttachment(input: CreateAttachmentParams, now: Date = new Date()): Attachment {
  const id = crypto.randomUUID();
  writeAttachmentBlob(input.taskId, id, input.bytes);

  const db = getDb();
  const attachment: Attachment = {
    id,
    taskId: input.taskId,
    filename: sanitizeAttachmentFilename(input.filename),
    size: input.bytes.byteLength,
    mimeType: input.mimeType,
    uploadedAt: now.toISOString(),
    uploadedBy: input.uploadedBy,
  };

  db.attachments[attachment.id] = attachment;
  saveDb(db);
  return attachment;
}

export function listAttachmentsForTask(taskId: string, db: Database = getDb()): Attachment[] {
  return Object.values(db.attachments)
    .filter((attachment) => attachment.taskId === taskId)
    .sort(
      (a, b) =>
        new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime() || a.id.localeCompare(b.id),
    );
}

export function findAttachmentById(id: string): Attachment | undefined {
  return getDb().attachments[id];
}

export function readAttachmentBytes(attachment: Attachment): Uint8Array | undefined {
  return readAttachmentBlob(attachment.taskId, attachment.id);
}

// Metadata is removed before the bytes so a crash between the two steps
// leaves, at worst, an orphan file on disk (harmless, never surfaced by any
// API) — never orphan metadata pointing at bytes that no longer exist.
export function deleteAttachment(id: string): Attachment | undefined {
  const db = getDb();
  const existing = db.attachments[id];
  if (!existing) {
    return undefined;
  }

  delete db.attachments[id];
  saveDb(db);
  removeAttachmentBlob(existing.taskId, existing.id);
  return existing;
}
