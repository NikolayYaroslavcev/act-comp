import { listLists } from "@/entities/list/repository";
import { selectVisibleLists } from "@/entities/list/model";
import { listTasks } from "@/entities/task/repository";
import { selectVisibleTasks } from "@/entities/task/model";
import type { Task } from "@/entities/task/schema";

export async function listVisibleTasks(userId: string, listId?: string): Promise<Task[]> {
  const visibleListIds = new Set(selectVisibleLists(await listLists(), userId).map((list) => list.id));
  return selectVisibleTasks(await listTasks(listId), visibleListIds);
}
