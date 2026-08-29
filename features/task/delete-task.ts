import { findListById } from "@/entities/list/repository";
import { canDeleteList, canViewList } from "@/entities/list/model";
import { deleteTask as deleteTaskInRepository, findTaskById } from "@/entities/task/repository";
import type { Task } from "@/entities/task/schema";

export type DeleteTaskOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; task: Task };

export function deleteTaskForUser(userId: string, taskId: string, now: Date = new Date()): DeleteTaskOutcome {
  const task = findTaskById(taskId);
  if (!task) {
    return { status: "not_found" };
  }

  const list = findListById(task.listId);
  if (!list || list.deletedAt !== null || !canViewList(list, userId)) {
    return { status: "not_found" };
  }

  if (!canDeleteList(list, userId)) {
    return { status: "forbidden" };
  }

  return deleteTaskInRepository(taskId, userId, now);
}
