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
export async function createAttachment(input: CreateAttachmentParams, now: Date = new Date()): Promise<Attachment> {
  const id = crypto.randomUUID();
  await writeAttachmentBlob(input.taskId, id, input.bytes);

  const db = await getDb();
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
  await saveDb(db);
  return attachment;
}

export async function listAttachmentsForTask(taskId: string, db?: Database): Promise<Attachment[]> {
  const resolved = db ?? (await getDb());
  return Object.values(resolved.attachments)
    .filter((attachment) => attachment.taskId === taskId)
    .sort(
      (a, b) =>
        new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime() || a.id.localeCompare(b.id),
    );
}

export async function findAttachmentById(id: string): Promise<Attachment | undefined> {
  return (await getDb()).attachments[id];
}

export async function readAttachmentBytes(attachment: Attachment): Promise<Uint8Array | undefined> {
  return readAttachmentBlob(attachment.taskId, attachment.id);
}

// Metadata is removed before the bytes so a crash between the two steps
// leaves, at worst, an orphan file on disk (harmless, never surfaced by any
// API) — never orphan metadata pointing at bytes that no longer exist.
export async function deleteAttachment(id: string): Promise<Attachment | undefined> {
  const db = await getDb();
  const existing = db.attachments[id];
  if (!existing) {
    return undefined;
  }

  delete db.attachments[id];
  await saveDb(db);
  await removeAttachmentBlob(existing.taskId, existing.id);
  return existing;
}
