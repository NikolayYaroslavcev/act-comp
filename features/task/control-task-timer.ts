import { findListById } from "@/entities/list/repository";
import { canEditList, canViewList } from "@/entities/list/model";
import { applyTaskTimer, findTaskById } from "@/entities/task/repository";
import type { TimerAction } from "@/entities/task/requests";
import type { Task } from "@/entities/task/schema";

export type ControlTaskTimerOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "completed" }
  | { status: "invalid_transition" }
  | { status: "ok"; task: Task };

export function controlTaskTimerForUser(
  userId: string,
  taskId: string,
  action: TimerAction,
  now: Date = new Date(),
): ControlTaskTimerOutcome {
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

  const result = applyTaskTimer(taskId, userId, action, now);
  if (result.status === "deleted" || result.status === "not_found") {
    return { status: "not_found" };
  }

  return result;
}
