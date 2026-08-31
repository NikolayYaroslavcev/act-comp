import { getVisibleTask } from "@/features/task/get-task";
import { findAttachmentById, readAttachmentBytes } from "@/entities/attachment/repository";
import type { Attachment } from "@/entities/attachment/schema";

export type DownloadTaskAttachmentOutcome =
  | { status: "not_found" }
  | { status: "ok"; attachment: Attachment; bytes: Uint8Array };

export async function downloadTaskAttachmentForUser(
  userId: string,
  taskId: string,
  attachmentId: string,
): Promise<DownloadTaskAttachmentOutcome> {
  const visible = await getVisibleTask(userId, taskId);
  if (visible.status === "not_found") {
    return { status: "not_found" };
  }

  const attachment = await findAttachmentById(attachmentId);
  // The attachmentId must belong to the task named in the URL — without this
  // check, a valid fileId for a task the caller can't view could be reached
  // by pairing it with the id of an unrelated task the caller *can* view.
  if (!attachment || attachment.taskId !== taskId) {
    return { status: "not_found" };
  }

  const bytes = await readAttachmentBytes(attachment);
  if (!bytes) {
    return { status: "not_found" };
  }

  return { status: "ok", attachment, bytes };
}
