import { findUserById } from "@/entities/user/repository";
import { listActivityForTask } from "@/entities/activity/repository";
import type { TaskActivityItem } from "@/entities/activity/dto";
import { getVisibleTask } from "@/features/task/get-task";

export type ListTaskActivityOutcome = { status: "not_found" } | { status: "ok"; activity: TaskActivityItem[] };

async function toActivityItem(
  entry: Awaited<ReturnType<typeof listActivityForTask>>[number],
): Promise<TaskActivityItem> {
  return { ...entry, actorEmail: (await findUserById(entry.byUserId))?.email ?? entry.byUserId };
}

export async function listTaskActivityForUser(userId: string, taskId: string): Promise<ListTaskActivityOutcome> {
  const visible = await getVisibleTask(userId, taskId);
  if (visible.status === "not_found") {
    return { status: "not_found" };
  }

  const entries = await listActivityForTask(taskId);
  return { status: "ok", activity: await Promise.all(entries.map(toActivityItem)) };
}
