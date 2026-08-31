import { findListById } from "@/entities/list/repository";
import { canEditList, canViewList } from "@/entities/list/model";
import { cloneTask as cloneTaskInRepository, findTaskById } from "@/entities/task/repository";
import type { Task } from "@/entities/task/schema";

export type CloneTaskOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "deleted" }
  | { status: "ok"; task: Task };

// Cloning creates a new task in the source's list, so it needs the same
// permission createTaskForUser requires (edit access) rather than the mere
// view access duplicateList allows for whole-list duplication into a list
// the caller will own — clone must never grant more than the caller already
// has on the source list.
export function cloneTaskForUser(userId: string, taskId: string): CloneTaskOutcome {
  const task = findTaskById(taskId);
  if (!task) {
    return { status: "not_found" };
  }

  const list = findListById(task.listId);
  if (!list || list.deletedAt !== null || !canViewList(list, userId)) {
    return { status: "not_found" };
  }

  if (task.deletedAt !== null) {
    return { status: "deleted" };
  }

  if (!canEditList(list, userId)) {
    return { status: "forbidden" };
  }

  return cloneTaskInRepository(taskId, new Date(), userId);
}
