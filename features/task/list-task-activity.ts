import { findUserById } from "@/entities/user/repository";
import { listActivityForTask } from "@/entities/activity/repository";
import type { TaskActivityItem } from "@/entities/activity/dto";
import { getVisibleTask } from "@/features/task/get-task";

export type ListTaskActivityOutcome = { status: "not_found" } | { status: "ok"; activity: TaskActivityItem[] };

function toActivityItem(entry: ReturnType<typeof listActivityForTask>[number]): TaskActivityItem {
  return { ...entry, actorEmail: findUserById(entry.byUserId)?.email ?? entry.byUserId };
}

export function listTaskActivityForUser(userId: string, taskId: string): ListTaskActivityOutcome {
  const visible = getVisibleTask(userId, taskId);
  if (visible.status === "not_found") {
    return { status: "not_found" };
  }

  return { status: "ok", activity: listActivityForTask(taskId).map(toActivityItem) };
}
