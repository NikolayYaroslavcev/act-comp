import { getVisibleTask } from "@/features/task/get-task";
import { listAttachmentsForTask } from "@/entities/attachment/repository";
import { findUserById } from "@/entities/user/repository";
import type { Attachment } from "@/entities/attachment/schema";
import type { AttachmentWithUploader } from "@/entities/attachment/dto";

export type ListTaskAttachmentsOutcome =
  | { status: "not_found" }
  | { status: "ok"; attachments: AttachmentWithUploader[] };

async function toAttachmentWithUploader(attachment: Attachment): Promise<AttachmentWithUploader> {
  return { ...attachment, uploaderEmail: (await findUserById(attachment.uploadedBy))?.email ?? attachment.uploadedBy };
}

export async function listTaskAttachmentsForUser(userId: string, taskId: string): Promise<ListTaskAttachmentsOutcome> {
  const visible = await getVisibleTask(userId, taskId);
  if (visible.status === "not_found") {
    return { status: "not_found" };
  }

  const attachments = await listAttachmentsForTask(taskId);
  return { status: "ok", attachments: await Promise.all(attachments.map(toAttachmentWithUploader)) };
}
