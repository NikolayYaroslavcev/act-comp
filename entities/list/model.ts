import type { Task } from "@/entities/task/schema";
import type { ListShare, SharedAccess, TaskList } from "@/entities/list/schema";
import type { Activity } from "@/entities/activity/schema";
import type { HistoryEntry } from "@/entities/common/schema";
import type { UpdateListInput } from "@/entities/list/requests";
import { findLatestActivityAmong } from "@/entities/activity/model";
import { isTaskOverdue } from "@/entities/task/model";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calculateListProgress(tasks: Task[]): number {
  if (tasks.length === 0) {
    return 0;
  }

  const done = tasks.filter((task) => task.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

const OVERDUE_PRIORITY_BOOST = 10;

export function calculateListPriority(tasks: Task[], now: Date = new Date()): number {
  const openTasks = tasks.filter((task) => task.status !== "done");

  if (openTasks.length === 0) {
    return 0;
  }

  const basePriority = Math.max(...openTasks.map((task) => task.priority));
  const hasOverdueTask = openTasks.some((task) => isTaskOverdue(task, now));

  return hasOverdueTask ? basePriority + OVERDUE_PRIORITY_BOOST : basePriority;
}

export function isListDeadlineOverdue(list: TaskList, now: Date): boolean {
  return list.deadline !== null && new Date(list.deadline).getTime() < now.getTime();
}

export function sortListsByPriority<T extends { priority: number }>(lists: T[]): T[] {
  return [...lists].sort((a, b) => b.priority - a.priority);
}

export function canViewList(list: TaskList, userId: string): boolean {
  return list.ownerId === userId || list.sharedWith.some((share) => share.userId === userId);
}

export function selectVisibleLists(lists: TaskList[], userId: string): TaskList[] {
  return lists.filter((list) => list.deletedAt === null && canViewList(list, userId));
}

export function findLatestListActivity(list: TaskList, activities: Activity[]): Activity | null {
  const relevantIds = new Set<string>([list.id, ...list.taskIds]);
  return findLatestActivityAmong(relevantIds, activities);
}

export function canEditList(list: TaskList, userId: string): boolean {
  if (list.ownerId === userId) {
    return true;
  }

  return list.sharedWith.some((share) => share.userId === userId && share.access === "edit");
}

export function canDeleteList(list: TaskList, userId: string): boolean {
  return list.ownerId === userId;
}

export function canManageListSharing(list: TaskList, userId: string): boolean {
  return list.ownerId === userId;
}

export function applyListShare(sharedWith: ListShare[], targetUserId: string, access: SharedAccess): ListShare[] {
  const existingIndex = sharedWith.findIndex((share) => share.userId === targetUserId);
  if (existingIndex === -1) {
    return [...sharedWith, { userId: targetUserId, access }];
  }

  return sharedWith.map((share, index) => (index === existingIndex ? { ...share, access } : share));
}

export function buildListDeletionHistoryEntry(list: TaskList, byUserId: string, at: string): HistoryEntry {
  return { field: "deletedAt", old: list.deletedAt, new: at, at, byUserId };
}

export function buildListRestorationHistoryEntry(list: TaskList, byUserId: string, at: string): HistoryEntry {
  return { field: "deletedAt", old: list.deletedAt, new: null, at, byUserId };
}

const RESTORE_WINDOW_DAYS = 30;

export function canRestoreList(list: TaskList, now: Date): boolean {
  if (list.deletedAt === null) {
    return false;
  }

  const elapsedMs = now.getTime() - new Date(list.deletedAt).getTime();
  return elapsedMs <= RESTORE_WINDOW_DAYS * MS_PER_DAY;
}

const UPDATABLE_LIST_FIELDS = ["title", "template", "deadline"] as const;

export function diffListChanges(
  previous: TaskList,
  patch: UpdateListInput,
  byUserId: string,
  at: string,
): HistoryEntry[] {
  const changes: HistoryEntry[] = [];

  for (const field of UPDATABLE_LIST_FIELDS) {
    if (!(field in patch)) {
      continue;
    }

    const nextValue = patch[field];
    if (nextValue === previous[field]) {
      continue;
    }

    changes.push({ field, old: previous[field], new: nextValue, at, byUserId });
  }

  return changes;
}

export function buildDuplicatedList(
  source: TaskList,
  newId: string,
  ownerId: string,
  taskIds: string[],
  sharedWith: ListShare[],
  now: string,
): TaskList {
  return {
    id: newId,
    ownerId,
    title: source.title,
    template: source.template,
    taskIds,
    deadline: source.deadline,
    sharedWith,
    history: [],
    deletedAt: null,
    lastActivityAt: now,
  };
}

const ARCHIVE_CANDIDATE_INACTIVITY_DAYS = 30;

/**
 * A list with no recorded activity is not treated as a candidate: without a
 * creation timestamp on `TaskList` there is no safe way to tell "never
 * touched" apart from "just created", so flagging it would risk archiving a
 * brand-new list before it has any activity to report.
 */
export function isListArchiveCandidate(latestActivityAt: string | null, now: Date): boolean {
  if (latestActivityAt === null) {
    return false;
  }

  const elapsedMs = now.getTime() - new Date(latestActivityAt).getTime();
  return elapsedMs >= ARCHIVE_CANDIDATE_INACTIVITY_DAYS * MS_PER_DAY;
}
