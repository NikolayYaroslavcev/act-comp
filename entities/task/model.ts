import type { Task, TaskStatus } from "@/entities/task/schema";
import type { TimerAction, UpdateTaskInput } from "@/entities/task/requests";
import type { HistoryEntry } from "@/entities/common/schema";

export type TaskStatusCounts = Record<TaskStatus, number>;

/**
 * Signal about how tasks similar to the one being scored have historically
 * played out. The provider decides what counts as "similar" (e.g. same
 * category) and how it sources the data — calculatePriority only consumes
 * the result, so the fixture provider used before real analytics exists
 * (day 16 of the master-plan) can be swapped for a live one without
 * touching the algorithm itself.
 */
export interface TaskHistorySignal {
  averageActualMinutes: number;
}

export type TaskHistoryProvider = (task: Task) => TaskHistorySignal | null;

const TASK_OVERDUE_PRIORITY_BOOST = 10;
const TASK_DUE_WITHIN_24H_BOOST = 5;
const TASK_DUE_WITHIN_3D_BOOST = 2;
const TASK_BLOCKING_PRIORITY_BOOST = 5;
const TASK_HISTORY_OVERRUN_BOOST = 3;

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const DUE_SOON_WINDOW_MS = 24 * MS_PER_HOUR;
const DUE_LATER_WINDOW_MS = 3 * MS_PER_DAY;

export function isTaskOverdue(task: Task, now: Date): boolean {
  return task.deadline !== null && task.status !== "done" && new Date(task.deadline).getTime() < now.getTime();
}

function calculateDeadlineBoost(task: Task, now: Date): number {
  if (task.deadline === null) {
    return 0;
  }

  if (isTaskOverdue(task, now)) {
    return TASK_OVERDUE_PRIORITY_BOOST;
  }

  const msUntilDeadline = new Date(task.deadline).getTime() - now.getTime();
  if (msUntilDeadline <= DUE_SOON_WINDOW_MS) {
    return TASK_DUE_WITHIN_24H_BOOST;
  }
  if (msUntilDeadline <= DUE_LATER_WINDOW_MS) {
    return TASK_DUE_WITHIN_3D_BOOST;
  }
  return 0;
}

function isBlockingOpenTasks(task: Task, allTasks: Task[]): boolean {
  return allTasks.some(
    (other) =>
      other.id !== task.id &&
      other.deletedAt === null &&
      other.status !== "done" &&
      other.dependsOn.includes(task.id),
  );
}

function calculateHistoryBoost(task: Task, historyProvider: TaskHistoryProvider): number {
  if (task.estimatedMin <= 0) {
    return 0;
  }

  const signal = historyProvider(task);
  if (signal === null) {
    return 0;
  }

  return signal.averageActualMinutes > task.estimatedMin ? TASK_HISTORY_OVERRUN_BOOST : 0;
}

/**
 * Smart Priority Algorithm for a single task (master-plan day 3 domain
 * core). Combines the user-set priority with deadline proximity, whether
 * the task blocks other open work, and a history signal for similar tasks.
 * Done tasks return their own priority unmodified — a finished task carries
 * no urgency and no longer blocks anything.
 */
export function calculatePriority(
  task: Task,
  allTasks: Task[],
  historyProvider: TaskHistoryProvider,
  now: Date = new Date(),
): number {
  if (task.status === "done") {
    return task.priority;
  }

  const deadlineBoost = calculateDeadlineBoost(task, now);
  const dependencyBoost = isBlockingOpenTasks(task, allTasks) ? TASK_BLOCKING_PRIORITY_BOOST : 0;
  const historyBoost = calculateHistoryBoost(task, historyProvider);

  return task.priority + deadlineBoost + dependencyBoost + historyBoost;
}

export class DependencyCycleError extends Error {
  constructor(public readonly taskId: string) {
    super(`Dependency cycle detected involving task "${taskId}"`);
    this.name = "DependencyCycleError";
  }
}

/**
 * dependsOn holds prerequisite ids: task.dependsOn.includes(other.id) means
 * other must be resolved before task. An id with no matching task is
 * ignored rather than treated as a phantom node or a cycle.
 */
export function detectCycle(tasks: Task[]): boolean {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(task: Task): boolean {
    if (visited.has(task.id)) {
      return false;
    }
    if (visiting.has(task.id)) {
      return true;
    }

    visiting.add(task.id);
    for (const depId of task.dependsOn) {
      const dep = byId.get(depId);
      if (dep && visit(dep)) {
        return true;
      }
    }
    visiting.delete(task.id);
    visited.add(task.id);
    return false;
  }

  return tasks.some((task) => visit(task));
}

/**
 * Depth-first postorder topological sort: each task is appended only after
 * all of its dependsOn prerequisites have been appended, so independent
 * tasks/subtrees come out in the order they were first reached — i.e. the
 * order of the input array — rather than an arbitrary one.
 */
export function topoSort(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: Task[] = [];

  function visit(task: Task): void {
    if (visited.has(task.id)) {
      return;
    }
    if (visiting.has(task.id)) {
      throw new DependencyCycleError(task.id);
    }

    visiting.add(task.id);
    for (const depId of task.dependsOn) {
      const dep = byId.get(depId);
      if (dep) {
        visit(dep);
      }
    }
    visiting.delete(task.id);
    visited.add(task.id);
    result.push(task);
  }

  for (const task of tasks) {
    visit(task);
  }

  return result;
}

export interface CascadeUpdate {
  taskId: string;
  isBlocked: boolean;
  recalculatedPriority: number;
}

export function isTaskBlocked(task: Task, byId: ReadonlyMap<string, Task>): boolean {
  return task.dependsOn.some((depId) => {
    const dep = byId.get(depId);
    return dep !== undefined && dep.deletedAt === null && dep.status !== "done";
  });
}

/**
 * Downstream = tasks that depend on the changed one, directly or
 * transitively (task.dependsOn = ["b"] means b -> task, so task is
 * downstream of b). `task` is expected to already carry its post-change
 * state and be present as such in `allTasks`, mirroring calculatePriority's
 * own (task, allTasks, ...) convention. Reuses topoSort for both cycle
 * detection (it throws DependencyCycleError) and deterministic ordering,
 * and calculatePriority for the priority figure, rather than
 * reimplementing either.
 */
export function getCascadeUpdates(
  task: Task,
  allTasks: Task[],
  historyProvider: TaskHistoryProvider,
  now: Date = new Date(),
): CascadeUpdate[] {
  const ordered = topoSort(allTasks);
  const byId = new Map(allTasks.map((t) => [t.id, t]));

  const downstreamIds = new Set<string>();
  const stack = [task.id];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    for (const candidate of allTasks) {
      if (
        candidate.deletedAt === null &&
        candidate.id !== task.id &&
        !downstreamIds.has(candidate.id) &&
        candidate.dependsOn.includes(currentId)
      ) {
        downstreamIds.add(candidate.id);
        stack.push(candidate.id);
      }
    }
  }

  return ordered
    .filter((t) => downstreamIds.has(t.id))
    .map((t) => ({
      taskId: t.id,
      isBlocked: isTaskBlocked(t, byId),
      recalculatedPriority: calculatePriority(t, allTasks, historyProvider, now),
    }));
}

export type ParentAssignmentError = "not_found" | "deleted" | "different_list" | "self" | "cycle";

function isAncestorOf(candidateAncestorId: string, startId: string, tasksById: ReadonlyMap<string, Task>): boolean {
  const seen = new Set<string>();
  let current = tasksById.get(startId);
  while (current && current.parentId !== null && !seen.has(current.id)) {
    if (current.parentId === candidateAncestorId) {
      return true;
    }
    seen.add(current.id);
    current = tasksById.get(current.parentId);
  }
  return false;
}

/**
 * Parent hierarchy is a separate tree from dependsOn, so it needs its own
 * cycle check (walking parentId chains) rather than reusing detectCycle,
 * which only understands the dependsOn graph.
 */
export function validateParentAssignment(
  child: Task,
  parentId: string,
  tasksById: ReadonlyMap<string, Task>,
): ParentAssignmentError | null {
  if (parentId === child.id) {
    return "self";
  }

  const parent = tasksById.get(parentId);
  if (!parent) {
    return "not_found";
  }
  if (parent.deletedAt !== null) {
    return "deleted";
  }
  if (parent.listId !== child.listId) {
    return "different_list";
  }
  if (isAncestorOf(child.id, parentId, tasksById)) {
    return "cycle";
  }

  return null;
}

export interface ParentSyncUpdate {
  taskId: string;
  subtaskIds: string[];
}

/**
 * Pure diff of the subtaskIds mirror: dropping childId from the previous
 * parent's list and adding it to the next parent's list, whichever of the
 * two actually apply. Used for parentId assignment/removal, and reused as-is
 * for the delete (next = null) and restore (previous = null) side effects.
 */
export function computeParentSyncUpdates(
  childId: string,
  previousParentId: string | null,
  nextParentId: string | null,
  tasksById: ReadonlyMap<string, Task>,
): ParentSyncUpdate[] {
  if (previousParentId === nextParentId) {
    return [];
  }

  const updates: ParentSyncUpdate[] = [];

  if (previousParentId !== null) {
    const oldParent = tasksById.get(previousParentId);
    if (oldParent) {
      updates.push({ taskId: oldParent.id, subtaskIds: oldParent.subtaskIds.filter((id) => id !== childId) });
    }
  }

  if (nextParentId !== null) {
    const newParent = tasksById.get(nextParentId);
    if (newParent && !newParent.subtaskIds.includes(childId)) {
      updates.push({ taskId: newParent.id, subtaskIds: [...newParent.subtaskIds, childId] });
    }
  }

  return updates;
}

export interface ParentProgress {
  total: number;
  done: number;
  percent: number;
}

/**
 * Resolves a parent's subtaskIds mirror to the actual (non-deleted) task
 * objects, in subtaskIds order. Shared by calculateParentProgress and by UI
 * code that needs to render the active subtask list itself.
 */
export function selectActiveSubtasks(parent: Task, allTasks: Task[]): Task[] {
  const tasksById = new Map(allTasks.map((task) => [task.id, task]));
  return parent.subtaskIds
    .map((id) => tasksById.get(id))
    .filter((task): task is Task => task !== undefined && task.deletedAt === null);
}

/**
 * Direct-children-only progress: counts how many of the parent's active
 * (non-deleted) subtasks are done. Returns null rather than 0% when there
 * are no active subtasks, so callers can distinguish "nothing to show" from
 * "0% done" — the formula isn't specified by the brief, this is the minimal
 * reading of "auto-recalculated parent progress".
 */
export function calculateParentProgress(parent: Task, allTasks: Task[]): ParentProgress | null {
  const activeSubtasks = selectActiveSubtasks(parent, allTasks);

  if (activeSubtasks.length === 0) {
    return null;
  }

  const done = activeSubtasks.filter((task) => task.status === "done").length;
  return { total: activeSubtasks.length, done, percent: Math.round((done / activeSubtasks.length) * 100) };
}

const UPDATABLE_TASK_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "category",
  "tags",
  "deadline",
  "estimatedMin",
  "dependsOn",
  "parentId",
] as const;

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }
  return a === b;
}

/**
 * Mirrors entities/list/model.ts's diffListChanges: only fields present in
 * patch are considered (so an omitted field never produces an entry, but an
 * explicit null does), and a value equal to the existing one is a no-op.
 */
export function diffTaskChanges(
  previous: Task,
  patch: UpdateTaskInput,
  byUserId: string,
  at: string,
): HistoryEntry[] {
  const changes: HistoryEntry[] = [];

  for (const field of UPDATABLE_TASK_FIELDS) {
    if (!(field in patch)) {
      continue;
    }

    const nextValue = patch[field];
    if (valuesEqual(nextValue, previous[field])) {
      continue;
    }

    changes.push({ field, old: previous[field], new: nextValue, at, byUserId });
  }

  return changes;
}

export function buildTaskDeletionHistoryEntry(task: Task, byUserId: string, at: string): HistoryEntry {
  return { field: "deletedAt", old: task.deletedAt, new: at, at, byUserId };
}

export function buildTaskRestorationHistoryEntry(task: Task, byUserId: string, at: string): HistoryEntry {
  return { field: "deletedAt", old: task.deletedAt, new: null, at, byUserId };
}

const RESTORE_WINDOW_DAYS = 30;

export function canRestoreTask(task: Task, now: Date): boolean {
  if (task.deletedAt === null) {
    return false;
  }

  const elapsedMs = now.getTime() - new Date(task.deletedAt).getTime();
  return elapsedMs <= RESTORE_WINDOW_DAYS * MS_PER_DAY;
}

export function selectVisibleTasks(tasks: Task[], visibleListIds: ReadonlySet<string>): Task[] {
  return tasks.filter((task) => task.deletedAt === null && visibleListIds.has(task.listId));
}

export const KANBAN_STATUSES: readonly TaskStatus[] = ["new", "in_progress", "done"];

/**
 * Deterministic within-column order: no persisted position field exists in
 * the task model, so ordering is derived on every read rather than stored
 * or reordered by drag — highest priority first, ties broken by creation
 * order so the result never depends on Map/Set iteration order.
 */
export function sortTasksForKanbanColumn(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function applyKanbanStatusOverrides(
  tasks: Task[],
  overrides: Readonly<Record<string, TaskStatus>>,
): Task[] {
  return tasks.map((task) => {
    const nextStatus = overrides[task.id];
    return nextStatus === undefined ? task : { ...task, status: nextStatus };
  });
}

export function groupTasksByKanbanColumn(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups = { new: [], in_progress: [], done: [] } as Record<TaskStatus, Task[]>;
  const visible = tasks.filter((task) => task.deletedAt === null);
  for (const status of KANBAN_STATUSES) {
    groups[status] = sortTasksForKanbanColumn(visible.filter((task) => task.status === status));
  }
  return groups;
}

export function countTasksByStatus(tasks: Task[]): TaskStatusCounts {
  const counts: TaskStatusCounts = { new: 0, in_progress: 0, done: 0 };
  for (const task of tasks) {
    counts[task.status] += 1;
  }
  return counts;
}

/**
 * dependsOn/parentId/subtaskIds only make sense as references within the
 * same list, so remapping (rather than copying verbatim) is what keeps a
 * duplicated list's task graph self-consistent instead of pointing back at
 * the original tasks.
 */
export function buildDuplicatedTasks(
  sourceTasks: Task[],
  newListId: string,
  now: string,
  generateId: () => string,
): Task[] {
  const activeTasks = sourceTasks.filter((task) => task.deletedAt === null);
  const idMap = new Map<string, string>(activeTasks.map((task) => [task.id, generateId()]));
  const remap = (id: string) => idMap.get(id);
  const remapAll = (ids: string[]) => ids.flatMap((id) => {
    const mapped = remap(id);
    return mapped ? [mapped] : [];
  });

  return activeTasks.map((task) => ({
    id: idMap.get(task.id)!,
    listId: newListId,
    code: task.code,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    category: task.category,
    tags: [...task.tags],
    dependsOn: remapAll(task.dependsOn),
    parentId: task.parentId !== null ? (remap(task.parentId) ?? null) : null,
    subtaskIds: remapAll(task.subtaskIds),
    deadline: task.deadline,
    createdAt: now,
    estimatedMin: task.estimatedMin,
    timeSpentMin: 0,
    timerStartedAt: null,
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
  }));
}

function taskSearchHaystack(task: Task): string[] {
  return [task.code, task.title, task.description, task.category ?? "", ...task.tags];
}

/**
 * Full-text search over the fields that are meaningful as free text
 * (code/title/description/category/tags). status/priority/dates are
 * filter concerns, not search concerns — see filterTasks.
 */
export function searchTasks(tasks: Task[], query: string): Task[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") {
    return [...tasks];
  }

  return tasks.filter((task) => taskSearchHaystack(task).some((value) => value.toLowerCase().includes(normalized)));
}

export interface TaskFilters {
  status?: TaskStatus[];
  category?: string;
  tags?: string[];
  priorityMin?: number;
  priorityMax?: number;
  deadlineFrom?: string;
  deadlineTo?: string;
}

function taskMatchesDeadlineRange(task: Task, filters: TaskFilters): boolean {
  if (filters.deadlineFrom === undefined && filters.deadlineTo === undefined) {
    return true;
  }
  if (task.deadline === null) {
    return false;
  }

  const deadlineMs = new Date(task.deadline).getTime();
  if (filters.deadlineFrom !== undefined && deadlineMs < new Date(filters.deadlineFrom).getTime()) {
    return false;
  }
  if (filters.deadlineTo !== undefined && deadlineMs > new Date(filters.deadlineTo).getTime()) {
    return false;
  }
  return true;
}

function taskMatchesFilters(task: Task, filters: TaskFilters): boolean {
  if (filters.status && filters.status.length > 0 && !filters.status.includes(task.status)) {
    return false;
  }
  if (filters.category !== undefined && task.category !== filters.category) {
    return false;
  }
  if (filters.tags && filters.tags.length > 0 && !filters.tags.some((tag) => task.tags.includes(tag))) {
    return false;
  }
  if (filters.priorityMin !== undefined && task.priority < filters.priorityMin) {
    return false;
  }
  if (filters.priorityMax !== undefined && task.priority > filters.priorityMax) {
    return false;
  }
  return taskMatchesDeadlineRange(task, filters);
}

/**
 * Structured filters (status/category/tags/priority range/deadline range),
 * every provided dimension combined with AND. Complements searchTasks,
 * which covers free-text fields only.
 */
export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter((task) => taskMatchesFilters(task, filters));
}

export interface TaskQuery {
  search: string;
  filters: TaskFilters;
}

export function applyTaskQuery(tasks: Task[], query: TaskQuery): Task[] {
  return filterTasks(searchTasks(tasks, query.search), query.filters);
}

const MS_PER_MINUTE = 60_000;

export type TimerState = "stopped" | "running" | "paused";

export type ApplyTimerActionOutcome =
  | { status: "ok"; task: Task }
  | { status: "completed" }
  | { status: "deleted" }
  | { status: "invalid_transition" };

/**
 * Running = an open session (`timerStartedAt` set, `timerPausedAt` cleared).
 * Paused wins if `timerPausedAt` is set, even when `timerStartedAt` is also
 * present, so UI/server never add wall-clock time on top of already-committed
 * `timeSpentMin`. Stopped is both timestamps null.
 */
export function getTimerState(task: Pick<Task, "timerStartedAt" | "timerPausedAt">): TimerState {
  if (task.timerPausedAt !== null) {
    return "paused";
  }
  if (task.timerStartedAt !== null) {
    return "running";
  }
  return "stopped";
}

export function elapsedMs(task: Pick<Task, "timeSpentMin" | "timerStartedAt" | "timerPausedAt">, now: Date): number {
  const committedMs = task.timeSpentMin * MS_PER_MINUTE;
  if (getTimerState(task) !== "running" || task.timerStartedAt === null) {
    return committedMs;
  }

  const runningMs = now.getTime() - Date.parse(task.timerStartedAt);
  return committedMs + Math.max(0, runningMs);
}

export function elapsedMinutes(
  task: Pick<Task, "timeSpentMin" | "timerStartedAt" | "timerPausedAt">,
  now: Date,
): number {
  return Math.floor(elapsedMs(task, now) / MS_PER_MINUTE);
}

export function estimateProgressPercent(elapsedMin: number, estimatedMin: number): number | null {
  if (estimatedMin <= 0) {
    return null;
  }
  return Math.min(100, Math.floor((elapsedMin * 100) / estimatedMin));
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatElapsedClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
}

function commitRunningMinutes(task: Task, now: Date): number {
  if (getTimerState(task) !== "running" || task.timerStartedAt === null) {
    return task.timeSpentMin;
  }
  const extra = Math.floor(Math.max(0, now.getTime() - Date.parse(task.timerStartedAt)) / MS_PER_MINUTE);
  return task.timeSpentMin + extra;
}

function appendTimerHistory(previous: Task, next: Task, byUserId: string, at: string): Task {
  const fields = ["timeSpentMin", "timerStartedAt", "timerPausedAt"] as const;
  const changes: HistoryEntry[] = [];
  for (const field of fields) {
    if (previous[field] === next[field]) {
      continue;
    }
    changes.push({ field, old: previous[field], new: next[field], at, byUserId });
  }
  if (changes.length === 0) {
    return previous;
  }
  return { ...next, history: [...previous.history, ...changes] };
}

/**
 * Pure timer transition. `timeSpentMin` is committed minutes from completed
 * (paused/stopped) sessions only; a running session is added with floor()
 * on pause/stop so ticks never persist. Timestamps are always taken from
 * `now`, never from the caller.
 */
export function applyTimerAction(task: Task, action: TimerAction, now: Date, byUserId: string): ApplyTimerActionOutcome {
  if (task.deletedAt !== null) {
    return { status: "deleted" };
  }
  if (task.status === "done") {
    return { status: "completed" };
  }

  const state = getTimerState(task);
  const at = now.toISOString();

  if (action === "start") {
    if (state !== "stopped") {
      return { status: "invalid_transition" };
    }
    return { status: "ok", task: appendTimerHistory(task, { ...task, timerStartedAt: at, timerPausedAt: null }, byUserId, at) };
  }

  if (action === "pause") {
    if (state === "stopped") {
      return { status: "invalid_transition" };
    }
    if (state === "paused") {
      return { status: "ok", task };
    }
    return {
      status: "ok",
      task: appendTimerHistory(
        task,
        { ...task, timeSpentMin: commitRunningMinutes(task, now), timerStartedAt: null, timerPausedAt: at },
        byUserId,
        at,
      ),
    };
  }

  if (action === "resume") {
    if (state !== "paused") {
      return { status: "invalid_transition" };
    }
    return { status: "ok", task: appendTimerHistory(task, { ...task, timerStartedAt: at, timerPausedAt: null }, byUserId, at) };
  }

  if (state === "stopped") {
    return { status: "ok", task };
  }
  if (state === "paused") {
    return { status: "ok", task: appendTimerHistory(task, { ...task, timerStartedAt: null, timerPausedAt: null }, byUserId, at) };
  }
  return {
    status: "ok",
    task: appendTimerHistory(
      task,
      { ...task, timeSpentMin: commitRunningMinutes(task, now), timerStartedAt: null, timerPausedAt: null },
      byUserId,
      at,
    ),
  };
}
