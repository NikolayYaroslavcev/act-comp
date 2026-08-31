import { findListById } from "@/entities/list/repository";
import { canEditList, canViewList } from "@/entities/list/model";
import { findTaskById, rollbackTask as rollbackTaskInRepository } from "@/entities/task/repository";
import type { CascadeUpdate } from "@/entities/task/model";
import type { Task } from "@/entities/task/schema";

export type RollbackTaskOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unknown_version" }
  | { status: "invalid_parent" }
  | { status: "invalid_dependsOn" }
  | { status: "cycle" }
  | { status: "blocked" }
  | { status: "ok"; task: Task; cascade: CascadeUpdate[] };

export function rollbackTaskForUser(userId: string, taskId: string, historyIndex: number): RollbackTaskOutcome {
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

  return rollbackTaskInRepository(taskId, userId, historyIndex);
}
