import { listLists } from "@/entities/list/repository";
import { listTasks } from "@/entities/task/repository";
import { listActivity } from "@/entities/activity/repository";
import {
  calculateListPriority,
  calculateListProgress,
  findLatestListActivity,
  selectVisibleLists,
  sortListsByPriority,
} from "@/entities/list/model";
import { countTasksByStatus, type TaskStatusCounts } from "@/entities/task/model";

export interface DashboardListSummary {
  id: string;
  title: string;
  taskCount: number;
  statusCounts: TaskStatusCounts;
  progress: number;
  lastActivityAt: string | null;
  priority: number;
}

export function getDashboardLists(userId: string, now: Date = new Date()): DashboardListSummary[] {
  const visibleLists = selectVisibleLists(listLists(), userId);
  const activities = listActivity();

  const summaries = visibleLists.map((list) => {
    const tasks = listTasks(list.id).filter((task) => task.deletedAt === null);
    const latestActivity = findLatestListActivity(list, activities);

    return {
      id: list.id,
      title: list.title,
      taskCount: tasks.length,
      statusCounts: countTasksByStatus(tasks),
      progress: calculateListProgress(tasks),
      lastActivityAt: latestActivity?.at ?? null,
      priority: calculateListPriority(tasks, now),
    };
  });

  return sortListsByPriority(summaries);
}
