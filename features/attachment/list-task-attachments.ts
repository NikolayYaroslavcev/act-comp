import { getVisibleTask } from "@/features/task/get-task";
import { listAttachmentsForTask } from "@/entities/attachment/repository";
import { findUserById } from "@/entities/user/repository";
import type { Attachment } from "@/entities/attachment/schema";
import type { AttachmentWithUploader } from "@/entities/attachment/dto";

export type ListTaskAttachmentsOutcome =
  | { status: "not_found" }
  | { status: "ok"; attachments: AttachmentWithUploader[] };

function toAttachmentWithUploader(attachment: Attachment): AttachmentWithUploader {
  return { ...attachment, uploaderEmail: findUserById(attachment.uploadedBy)?.email ?? attachment.uploadedBy };
}

export function listTaskAttachmentsForUser(userId: string, taskId: string): ListTaskAttachmentsOutcome {
  const visible = getVisibleTask(userId, taskId);
  if (visible.status === "not_found") {
    return { status: "not_found" };
  }

  return { status: "ok", attachments: listAttachmentsForTask(taskId).map(toAttachmentWithUploader) };
}
