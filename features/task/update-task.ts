import { findListById } from "@/entities/list/repository";
import { canEditList, canViewList } from "@/entities/list/model";
import { findTaskById, updateTask as updateTaskInRepository } from "@/entities/task/repository";
import type { UpdateTaskInput } from "@/entities/task/requests";
import type { CascadeUpdate } from "@/entities/task/model";
import type { Task } from "@/entities/task/schema";

export type UpdateTaskOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_parent" }
  | { status: "invalid_dependsOn" }
  | { status: "cycle" }
  | { status: "blocked" }
  | { status: "ok"; task: Task; cascade: CascadeUpdate[] };

export function updateTaskForUser(userId: string, taskId: string, input: UpdateTaskInput): UpdateTaskOutcome {
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

  return updateTaskInRepository(taskId, userId, input);
}
