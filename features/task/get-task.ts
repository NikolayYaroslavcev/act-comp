import { findListById } from "@/entities/list/repository";
import { canViewList } from "@/entities/list/model";
import { findTaskById } from "@/entities/task/repository";
import type { Task } from "@/entities/task/schema";

export type GetTaskOutcome = { status: "not_found" } | { status: "ok"; task: Task };

export async function getVisibleTask(userId: string, taskId: string): Promise<GetTaskOutcome> {
  const task = await findTaskById(taskId);
  if (!task || task.deletedAt !== null) {
    return { status: "not_found" };
  }

  const list = await findListById(task.listId);
  if (!list || list.deletedAt !== null || !canViewList(list, userId)) {
    return { status: "not_found" };
  }

  return { status: "ok", task };
}
