import type { Task } from "@/entities/task/schema";
import type { ListShare, ListTemplate, SharedAccess, TaskList } from "@/entities/list/schema";
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

/**
 * Search/filter operate on this minimal structural shape (title/template/
 * deadline) rather than the full TaskList, so both a raw TaskList and a
 * DashboardListSummary (features/dashboard/dashboard-lists.ts) satisfy it
 * without a second, parallel implementation.
 */
interface ListSearchable {
  title: string;
  template: ListTemplate;
  deadline: string | null;
}

export function searchLists<T extends ListSearchable>(lists: T[], query: string): T[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") {
    return [...lists];
  }

  return lists.filter((list) => list.title.toLowerCase().includes(normalized));
}

export interface ListFilters {
  template?: ListTemplate[];
  deadlineFrom?: string;
  deadlineTo?: string;
}

function listMatchesDeadlineRange(list: ListSearchable, filters: ListFilters): boolean {
  if (filters.deadlineFrom === undefined && filters.deadlineTo === undefined) {
    return true;
  }
  if (list.deadline === null) {
    return false;
  }

  const deadlineMs = new Date(list.deadline).getTime();
  if (filters.deadlineFrom !== undefined && deadlineMs < new Date(filters.deadlineFrom).getTime()) {
    return false;
  }
  if (filters.deadlineTo !== undefined && deadlineMs > new Date(filters.deadlineTo).getTime()) {
    return false;
  }
  return true;
}

function listMatchesFilters(list: ListSearchable, filters: ListFilters): boolean {
  if (filters.template && filters.template.length > 0 && !filters.template.includes(list.template)) {
    return false;
  }
  return listMatchesDeadlineRange(list, filters);
}

export function filterLists<T extends ListSearchable>(lists: T[], filters: ListFilters): T[] {
  return lists.filter((list) => listMatchesFilters(list, filters));
}

export interface ListQuery {
  search: string;
  filters: ListFilters;
}

export function applyListQuery<T extends ListSearchable>(lists: T[], query: ListQuery): T[] {
  return filterLists(searchLists(lists, query.search), query.filters);
}

export type ListUrgency = "normal" | "warning" | "urgent";

// Same "due soon" window as the task Smart Priority algorithm
// (entities/task/model.ts DUE_SOON_WINDOW_MS) — one shared notion of "soon"
// rather than a second, list-specific scale.
const URGENCY_WARNING_WINDOW_MS = 24 * 60 * 60 * 1000;

function isDueSoon(deadline: string | null, now: Date): boolean {
  if (deadline === null) {
    return false;
  }
  const msUntilDeadline = new Date(deadline).getTime() - now.getTime();
  return msUntilDeadline >= 0 && msUntilDeadline <= URGENCY_WARNING_WINDOW_MS;
}

/**
 * Colour-coded urgency for a list card (ТЗ: "красный - есть просроченные,
 * жёлтый - скоро дедлайн"). Reuses isTaskOverdue/isListDeadlineOverdue for
 * the "urgent" signal rather than recomputing overdue-ness, and only adds
 * the "warning" (due soon, not yet overdue) tier on top.
 */
export function calculateListUrgency(list: TaskList, tasks: Task[], now: Date = new Date()): ListUrgency {
  const openTasks = tasks.filter((task) => task.status !== "done" && task.deletedAt === null);

  const hasOverdueTask = openTasks.some((task) => isTaskOverdue(task, now));
  if (hasOverdueTask || isListDeadlineOverdue(list, now)) {
    return "urgent";
  }

  const hasDueSoonTask = openTasks.some((task) => isDueSoon(task.deadline, now));
  if (hasDueSoonTask || isDueSoon(list.deadline, now)) {
    return "warning";
  }

  return "normal";
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
