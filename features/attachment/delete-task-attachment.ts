import { findListById } from "@/entities/list/repository";
import { canEditList, canViewList } from "@/entities/list/model";
import { findTaskById } from "@/entities/task/repository";
import { deleteAttachment, findAttachmentById } from "@/entities/attachment/repository";
import { recordActivity } from "@/entities/activity/repository";

export type DeleteTaskAttachmentOutcome = { status: "not_found" } | { status: "forbidden" } | { status: "ok" };

export function deleteTaskAttachmentForUser(
  userId: string,
  taskId: string,
  attachmentId: string,
): DeleteTaskAttachmentOutcome {
  const task = findTaskById(taskId);
  if (!task || task.deletedAt !== null) {
    return { status: "not_found" };
  }

  const list = findListById(task.listId);
  if (!list || list.deletedAt !== null || !canViewList(list, userId)) {
    return { status: "not_found" };
  }

  if (!canEditList(list, userId)) {
    return { status: "forbidden" };
  }

  const attachment = findAttachmentById(attachmentId);
  if (!attachment || attachment.taskId !== taskId) {
    return { status: "not_found" };
  }

  deleteAttachment(attachmentId);

  recordActivity({
    entityType: "task",
    entityId: taskId,
    action: "attachment_deleted",
    at: new Date().toISOString(),
    byUserId: userId,
    metadata: { attachmentId: attachment.id, filename: attachment.filename },
  });

  return { status: "ok" };
}
