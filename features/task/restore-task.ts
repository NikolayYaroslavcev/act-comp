import { findListById } from "@/entities/list/repository";
import { canDeleteList, canViewList } from "@/entities/list/model";
import { findTaskById, restoreTask as restoreTaskInRepository } from "@/entities/task/repository";
import type { Task } from "@/entities/task/schema";

export type RestoreTaskOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "expired" }
  | { status: "ok"; task: Task };

export async function restoreTaskForUser(userId: string, taskId: string, now: Date = new Date()): Promise<RestoreTaskOutcome> {
  const task = await findTaskById(taskId);
  if (!task) {
    return { status: "not_found" };
  }

  const list = await findListById(task.listId);
  if (!list || list.deletedAt !== null || !canViewList(list, userId)) {
    return { status: "not_found" };
  }

  if (!canDeleteList(list, userId)) {
    return { status: "forbidden" };
  }

  return restoreTaskInRepository(taskId, userId, now);
}
