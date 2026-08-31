import { listLists } from "@/entities/list/repository";
import { listTasks } from "@/entities/task/repository";
import { listActivity } from "@/entities/activity/repository";
import {
  calculateListPriority,
  calculateListProgress,
  calculateListUrgency,
  canDeleteList,
  canEditList,
  canRestoreList,
  findLatestListActivity,
  isListArchiveCandidate,
  selectVisibleLists,
  sortListsByPriority,
  type ListUrgency,
} from "@/entities/list/model";
import type { ListTemplate } from "@/entities/list/schema";
import { countTasksByStatus, isTaskOverdue, type TaskStatusCounts } from "@/entities/task/model";

export interface DashboardListSummary {
  id: string;
  title: string;
  template: ListTemplate;
  deadline: string | null;
  taskCount: number;
  statusCounts: TaskStatusCounts;
  overdueCount: number;
  progress: number;
  urgency: ListUrgency;
  lastActivityAt: string | null;
  isArchiveCandidate: boolean;
  priority: number;
  canDelete: boolean;
  canEdit: boolean;
}

export interface DeletedListSummary {
  id: string;
  title: string;
  deletedAt: string;
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
      template: list.template,
      deadline: list.deadline,
      taskCount: tasks.length,
      statusCounts: countTasksByStatus(tasks),
      overdueCount: tasks.filter((task) => isTaskOverdue(task, now)).length,
      progress: calculateListProgress(tasks),
      urgency: calculateListUrgency(list, tasks, now),
      lastActivityAt: latestActivity?.at ?? null,
      isArchiveCandidate: isListArchiveCandidate(latestActivity?.at ?? null, now),
      priority: calculateListPriority(tasks, now),
      canDelete: canDeleteList(list, userId),
      canEdit: canEditList(list, userId),
    };
  });

  return sortListsByPriority(summaries);
}

export function getDeletedDashboardLists(userId: string, now: Date = new Date()): DeletedListSummary[] {
  return listLists()
    .filter((list) => list.deletedAt !== null && canDeleteList(list, userId) && canRestoreList(list, now))
    .map((list) => ({ id: list.id, title: list.title, deletedAt: list.deletedAt! }))
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}
