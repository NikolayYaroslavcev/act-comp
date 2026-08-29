import { listLists } from "@/entities/list/repository";
import { selectVisibleLists } from "@/entities/list/model";
import { listTasks } from "@/entities/task/repository";
import { selectVisibleTasks } from "@/entities/task/model";
import type { Task } from "@/entities/task/schema";

export function listVisibleTasks(userId: string, listId?: string): Task[] {
  const visibleListIds = new Set(selectVisibleLists(listLists(), userId).map((list) => list.id));
  return selectVisibleTasks(listTasks(listId), visibleListIds);
}
