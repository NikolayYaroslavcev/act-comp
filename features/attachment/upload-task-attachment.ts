import { findListById } from "@/entities/list/repository";
import { canEditList, canViewList } from "@/entities/list/model";
import { findTaskById } from "@/entities/task/repository";
import { createAttachment } from "@/entities/attachment/repository";
import { MAX_ATTACHMENT_SIZE_BYTES } from "@/entities/attachment/model";
import { findUserById } from "@/entities/user/repository";
import { recordActivity } from "@/entities/activity/repository";
import type { AttachmentWithUploader } from "@/entities/attachment/dto";

export interface UploadTaskAttachmentInput {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}

export type UploadTaskAttachmentOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "empty_file" }
  | { status: "too_large" }
  | { status: "ok"; attachment: AttachmentWithUploader };

// Uploading requires edit access to the parent list, not merely view access —
// same reasoning as createTaskCommentForUser: it's a mutation on the task.
export async function uploadTaskAttachmentForUser(
  userId: string,
  taskId: string,
  input: UploadTaskAttachmentInput,
): Promise<UploadTaskAttachmentOutcome> {
  const task = await findTaskById(taskId);
  if (!task || task.deletedAt !== null) {
    return { status: "not_found" };
  }

  const list = await findListById(task.listId);
  if (!list || list.deletedAt !== null || !canViewList(list, userId)) {
    return { status: "not_found" };
  }

  if (!canEditList(list, userId)) {
    return { status: "forbidden" };
  }

  if (input.bytes.byteLength === 0) {
    return { status: "empty_file" };
  }

  if (input.bytes.byteLength > MAX_ATTACHMENT_SIZE_BYTES) {
    return { status: "too_large" };
  }

  const attachment = await createAttachment({
    taskId,
    uploadedBy: userId,
    filename: input.filename,
    mimeType: input.mimeType,
    bytes: input.bytes,
  });

  await recordActivity({
    entityType: "task",
    entityId: taskId,
    action: "attachment_added",
    at: attachment.uploadedAt,
    byUserId: userId,
    metadata: { attachmentId: attachment.id, filename: attachment.filename },
  });

  return {
    status: "ok",
    attachment: { ...attachment, uploaderEmail: (await findUserById(userId))?.email ?? userId },
  };
}
