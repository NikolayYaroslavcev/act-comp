import { findListById } from "@/entities/list/repository";
import { canViewList } from "@/entities/list/model";
import { findTaskById } from "@/entities/task/repository";
import type { Task } from "@/entities/task/schema";

export type GetTaskOutcome = { status: "not_found" } | { status: "ok"; task: Task };

export function getVisibleTask(userId: string, taskId: string): GetTaskOutcome {
  const task = findTaskById(taskId);
  if (!task || task.deletedAt !== null) {
    return { status: "not_found" };
  }

  const list = findListById(task.listId);
  if (!list || list.deletedAt !== null || !canViewList(list, userId)) {
    return { status: "not_found" };
  }

  return { status: "ok", task };
}
