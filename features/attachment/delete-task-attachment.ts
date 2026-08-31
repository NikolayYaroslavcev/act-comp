import { findListById } from "@/entities/list/repository";
import { canEditList, canViewList } from "@/entities/list/model";
import { findTaskById } from "@/entities/task/repository";
import { deleteAttachment, findAttachmentById } from "@/entities/attachment/repository";
import { recordActivity } from "@/entities/activity/repository";

export type DeleteTaskAttachmentOutcome = { status: "not_found" } | { status: "forbidden" } | { status: "ok" };

export async function deleteTaskAttachmentForUser(
  userId: string,
  taskId: string,
  attachmentId: string,
): Promise<DeleteTaskAttachmentOutcome> {
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

  const attachment = await findAttachmentById(attachmentId);
  if (!attachment || attachment.taskId !== taskId) {
    return { status: "not_found" };
  }

  await deleteAttachment(attachmentId);

  await recordActivity({
    entityType: "task",
    entityId: taskId,
    action: "attachment_deleted",
    at: new Date().toISOString(),
    byUserId: userId,
    metadata: { attachmentId: attachment.id, filename: attachment.filename },
  });

  return { status: "ok" };
}
