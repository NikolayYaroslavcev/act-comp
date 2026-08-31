import { getDb, saveDb } from "@/shared/lib/db";
import type { Database } from "@/entities/database/schema";
import { appendActivity } from "@/entities/activity/repository";
import type { ActivityAction } from "@/entities/activity/schema";
import type { HistoryEntry } from "@/entities/common/schema";
import type { Task } from "@/entities/task/schema";
import type { CreateTaskInput, TimerAction, UpdateTaskInput } from "@/entities/task/requests";
import { DEFAULT_SETTINGS } from "@/entities/user/schema";
import {
  applyTimerAction,
  buildDuplicatedTasks,
  buildRollbackPatch,
  buildTaskDeletionHistoryEntry,
  buildTaskRestorationHistoryEntry,
  canRestoreTask,
  computeParentSyncUpdates,
  createSimilarTaskHistoryProvider,
  detectCycle,
  diffTaskChanges,
  getCascadeUpdates,
  isTaskBlocked,
  reconstructUpdatableStateBeforeHistoryIndex,
  validateDependsOnAssignment,
  validateParentAssignment,
  type CascadeUpdate,
  type ParentSyncUpdate,
} from "@/entities/task/model";

const TASK_CODE_PATTERN = /^TEST-(\d+)$/;

// Gap-filling, scoped per list: picks the lowest unused TEST-N number rather
// than counting tasks, so a code is never reissued. Soft-deleted tasks keep
// their record (and code) in db.tasks, so their numbers stay occupied.
function nextTaskCode(db: Database, listId: string): string {
  const usedNumbers = new Set<number>();
  for (const task of Object.values(db.tasks)) {
    if (task.listId !== listId) {
      continue;
    }

    const match = TASK_CODE_PATTERN.exec(task.code);
    if (match) {
      usedNumbers.add(Number(match[1]));
    }
  }

  let candidate = 1;
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }

  return `TEST-${candidate}`;
}

export function listTasks(listId?: string, db: Database = getDb()): Task[] {
  const tasks = Object.values(db.tasks);
  return listId ? tasks.filter((task) => task.listId === listId) : tasks;
}

export function findTaskById(id: string): Task | undefined {
  return getDb().tasks[id];
}

export function countTasks(): number {
  return Object.keys(getDb().tasks).length;
}

function activityActionForTaskField(field: string): ActivityAction {
  return field === "status" ? "status_changed" : "updated";
}

const TIMER_ACTIVITY_ACTION: Record<TimerAction, ActivityAction> = {
  start: "timer_started",
  pause: "timer_paused",
  resume: "timer_resumed",
  stop: "timer_stopped",
};

function recordTaskFieldActivity(
  db: Database,
  taskId: string,
  userId: string,
  at: string,
  field: string,
  oldValue: unknown,
  newValue: unknown,
): void {
  appendActivity(db, {
    entityType: "task",
    entityId: taskId,
    action: activityActionForTaskField(field),
    at,
    byUserId: userId,
    metadata: { field, old: oldValue, new: newValue },
  });
}

export function createTask(input: CreateTaskInput, byUserId?: string): Task {
  const db = getDb();
  const taskDefaults = (byUserId ? db.users[byUserId]?.settings.taskDefaults : undefined) ?? DEFAULT_SETTINGS.taskDefaults;
  const task: Task = {
    id: crypto.randomUUID(),
    listId: input.listId,
    code: nextTaskCode(db, input.listId),
    title: input.title,
    description: input.description,
    status: "new",
    priority: input.priority !== undefined ? input.priority : taskDefaults.priority,
    category: input.category !== undefined ? input.category : taskDefaults.category,
    tags: input.tags,
    dependsOn: [],
    parentId: input.parentId,
    subtaskIds: [],
    deadline: input.deadline,
    createdAt: new Date().toISOString(),
    estimatedMin: input.estimatedMin !== undefined ? input.estimatedMin : taskDefaults.estimatedMin,
    timeSpentMin: 0,
    timerStartedAt: null,
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
  };

  db.tasks[task.id] = task;
  const parentList = db.lists[input.listId];
  if (parentList) {
    db.lists[input.listId] = { ...parentList, taskIds: [...parentList.taskIds, task.id] };
  }
  if (byUserId !== undefined) {
    appendActivity(db, {
      entityType: "task",
      entityId: task.id,
      action: "created",
      at: task.createdAt,
      byUserId,
    });
  }
  saveDb(db);
  return task;
}

function tasksByIdMap(db: Database): Map<string, Task> {
  return new Map(Object.values(db.tasks).map((task) => [task.id, task]));
}

function applyParentSyncUpdates(db: Database, updates: ParentSyncUpdate[]): void {
  for (const update of updates) {
    const target = db.tasks[update.taskId];
    if (target) {
      db.tasks[update.taskId] = { ...target, subtaskIds: update.subtaskIds };
    }
  }
}

export type UpdateTaskOutcome =
  | { status: "not_found" }
  | { status: "invalid_parent" }
  | { status: "invalid_dependsOn" }
  | { status: "cycle" }
  | { status: "blocked" }
  | { status: "ok"; task: Task; cascade: CascadeUpdate[] };

export function updateTask(
  id: string,
  userId: string,
  patch: UpdateTaskInput,
  now: Date = new Date(),
  options: { recordFieldActivity?: boolean } = {},
): UpdateTaskOutcome {
  const db = getDb();
  const existing = db.tasks[id];
  if (!existing || existing.deletedAt !== null) {
    return { status: "not_found" };
  }

  if ("parentId" in patch && patch.parentId !== null && patch.parentId !== undefined) {
    const error = validateParentAssignment(existing, patch.parentId, tasksByIdMap(db));
    if (error) {
      return { status: "invalid_parent" };
    }
  }

  if ("dependsOn" in patch && patch.dependsOn !== undefined) {
    const error = validateDependsOnAssignment(existing, patch.dependsOn, tasksByIdMap(db));
    if (error) {
      return { status: "invalid_dependsOn" };
    }
  }

  const nowIso = now.toISOString();
  const changes = diffTaskChanges(existing, patch, userId, nowIso);
  if (changes.length === 0) {
    return { status: "ok", task: existing, cascade: [] };
  }

  const candidate: Task = { ...existing, ...patch };

  if (changes.some((change) => change.field === "dependsOn")) {
    const siblings = listTasks(existing.listId, db).map((task) => (task.id === id ? candidate : task));
    if (detectCycle(siblings)) {
      return { status: "cycle" };
    }
  }

  if (candidate.status === "done" && changes.some((change) => change.field === "status")) {
    if (isTaskBlocked(candidate, tasksByIdMap(db))) {
      return { status: "blocked" };
    }
  }

  const updated: Task = { ...candidate, history: [...existing.history, ...changes] };
  db.tasks[id] = updated;

  if (options.recordFieldActivity !== false) {
    for (const change of changes) {
      recordTaskFieldActivity(db, id, userId, nowIso, change.field, change.old, change.new);
    }
  }

  if (changes.some((change) => change.field === "parentId")) {
    applyParentSyncUpdates(db, computeParentSyncUpdates(id, existing.parentId, updated.parentId, tasksByIdMap(db)));
  }

  let cascade: CascadeUpdate[] = [];
  if (changes.some((change) => change.field === "status")) {
    const listTasksWithUpdated = listTasks(existing.listId, db).map((task) => (task.id === id ? updated : task));
    cascade = getCascadeUpdates(updated, listTasksWithUpdated, createSimilarTaskHistoryProvider(listTasksWithUpdated), now);
  }

  saveDb(db);
  return { status: "ok", task: updated, cascade };
}

export type ApplyTaskExtensionOutcome = { status: "not_found" } | { status: "ok"; task: Task };

export interface TaskExtensionInput {
  commentId: string;
  addedMin: number;
}

// Extensions pair a task.extensions entry with an estimatedMin bump, which
// updateTask's generic patch can't express (extensions isn't part of
// UpdateTaskInput/UPDATABLE_TASK_FIELDS — it's an append-only log, not a
// user-editable field). This mirrors updateTask's own history/activity
// shape for the estimatedMin change instead of inventing a new one, the
// same way applyTaskTimer is a dedicated mutation alongside updateTask
// rather than routed through it.
export function applyTaskExtension(
  id: string,
  userId: string,
  extension: TaskExtensionInput,
  now: Date = new Date(),
): ApplyTaskExtensionOutcome {
  const db = getDb();
  const existing = db.tasks[id];
  if (!existing || existing.deletedAt !== null) {
    return { status: "not_found" };
  }

  const nowIso = now.toISOString();
  const newEstimatedMin = existing.estimatedMin + extension.addedMin;
  const historyEntry: HistoryEntry = {
    field: "estimatedMin",
    old: existing.estimatedMin,
    new: newEstimatedMin,
    at: nowIso,
    byUserId: userId,
  };
  const updated: Task = {
    ...existing,
    estimatedMin: newEstimatedMin,
    extensions: [...existing.extensions, { commentId: extension.commentId, addedMin: extension.addedMin }],
    history: [...existing.history, historyEntry],
  };
  db.tasks[id] = updated;
  recordTaskFieldActivity(db, id, userId, nowIso, "estimatedMin", existing.estimatedMin, newEstimatedMin);
  saveDb(db);
  return { status: "ok", task: updated };
}

export type RollbackTaskOutcome =
  | { status: "not_found" }
  | { status: "unknown_version" }
  | { status: "invalid_parent" }
  | { status: "invalid_dependsOn" }
  | { status: "cycle" }
  | { status: "blocked" }
  | { status: "ok"; task: Task; cascade: CascadeUpdate[] };

export function rollbackTask(
  id: string,
  userId: string,
  historyIndex: number,
  now: Date = new Date(),
): RollbackTaskOutcome {
  const existing = findTaskById(id);
  if (!existing || existing.deletedAt !== null) {
    return { status: "not_found" };
  }

  const reconstructed = reconstructUpdatableStateBeforeHistoryIndex(existing, historyIndex);
  if (reconstructed.status !== "ok") {
    return { status: "unknown_version" };
  }

  const result = updateTask(id, userId, buildRollbackPatch(existing, reconstructed.snapshot), now, {
    recordFieldActivity: false,
  });
  if (result.status === "ok" && result.task.history.length > existing.history.length) {
    const db = getDb();
    appendActivity(db, {
      entityType: "task",
      entityId: id,
      action: "rolled_back",
      at: now.toISOString(),
      byUserId: userId,
      metadata: { historyIndex },
    });
    saveDb(db);
  }
  return result;
}

export function insertTasks(tasks: Task[], db: Database = getDb()): void {
  for (const task of tasks) {
    db.tasks[task.id] = task;
  }
  saveDb(db);
}

export type CloneTaskOutcome = { status: "not_found" } | { status: "deleted" } | { status: "ok"; task: Task };

// Reuses buildDuplicatedTasks (written for whole-list duplication) for a
// single source task: its id-remapping naturally drops dependsOn/parentId/
// subtaskIds references, since none of those ids resolve within a one-task
// input — exactly the "don't invent ids for tasks that aren't being cloned"
// behavior a single-task clone needs. Only the code needs to be overridden
// afterwards, since buildDuplicatedTasks copies it verbatim (fine for a
// duplicated list, which has its own code namespace; not fine here, where
// the clone lands in the same list as the source).
export function cloneTask(id: string, now: Date = new Date(), byUserId?: string): CloneTaskOutcome {
  const db = getDb();
  const existing = db.tasks[id];
  if (!existing) {
    return { status: "not_found" };
  }

  if (existing.deletedAt !== null) {
    return { status: "deleted" };
  }

  const nowIso = now.toISOString();
  const [duplicate] = buildDuplicatedTasks([existing], existing.listId, nowIso, () => crypto.randomUUID());
  const clone: Task = { ...duplicate, code: nextTaskCode(db, existing.listId) };

  db.tasks[clone.id] = clone;
  const parentList = db.lists[existing.listId];
  if (parentList) {
    db.lists[existing.listId] = { ...parentList, taskIds: [...parentList.taskIds, clone.id] };
  }
  if (byUserId !== undefined) {
    appendActivity(db, {
      entityType: "task",
      entityId: clone.id,
      action: "duplicated",
      at: nowIso,
      byUserId,
      metadata: { sourceTaskId: existing.id },
    });
  }
  saveDb(db);
  return { status: "ok", task: clone };
}

export type DeleteTaskOutcome = { status: "not_found" } | { status: "ok"; task: Task };

export function deleteTask(id: string, userId: string, now: Date = new Date()): DeleteTaskOutcome {
  const db = getDb();
  const existing = db.tasks[id];
  if (!existing) {
    return { status: "not_found" };
  }

  if (existing.deletedAt !== null) {
    return { status: "ok", task: existing };
  }

  const nowIso = now.toISOString();
  const updated: Task = {
    ...existing,
    deletedAt: nowIso,
    history: [...existing.history, buildTaskDeletionHistoryEntry(existing, userId, nowIso)],
  };
  db.tasks[id] = updated;
  appendActivity(db, {
    entityType: "task",
    entityId: id,
    action: "deleted",
    at: nowIso,
    byUserId: userId,
  });

  if (existing.parentId !== null) {
    applyParentSyncUpdates(db, computeParentSyncUpdates(id, existing.parentId, null, tasksByIdMap(db)));
  }

  saveDb(db);
  return { status: "ok", task: updated };
}

export type RestoreTaskOutcome = { status: "not_found" } | { status: "expired" } | { status: "ok"; task: Task };

export function restoreTask(id: string, userId: string, now: Date = new Date()): RestoreTaskOutcome {
  const db = getDb();
  const existing = db.tasks[id];
  if (!existing) {
    return { status: "not_found" };
  }

  if (existing.deletedAt === null) {
    return { status: "ok", task: existing };
  }

  if (!canRestoreTask(existing, now)) {
    return { status: "expired" };
  }

  const nowIso = now.toISOString();
  const updated: Task = {
    ...existing,
    deletedAt: null,
    history: [...existing.history, buildTaskRestorationHistoryEntry(existing, userId, nowIso)],
  };
  db.tasks[id] = updated;
  appendActivity(db, {
    entityType: "task",
    entityId: id,
    action: "restored",
    at: nowIso,
    byUserId: userId,
  });

  if (existing.parentId !== null) {
    const parent = db.tasks[existing.parentId];
    if (parent && parent.deletedAt === null) {
      applyParentSyncUpdates(db, computeParentSyncUpdates(id, null, existing.parentId, tasksByIdMap(db)));
    }
  }

  saveDb(db);
  return { status: "ok", task: updated };
}

export type ApplyTaskTimerOutcome =
  | { status: "not_found" }
  | { status: "completed" }
  | { status: "deleted" }
  | { status: "invalid_transition" }
  | { status: "ok"; task: Task };

export function applyTaskTimer(
  id: string,
  userId: string,
  action: TimerAction,
  now: Date = new Date(),
): ApplyTaskTimerOutcome {
  const db = getDb();
  const existing = db.tasks[id];
  if (!existing) {
    return { status: "not_found" };
  }

  const result = applyTimerAction(
    existing,
    action,
    now,
    userId,
    db.users[userId]?.settings.workDayHours ?? DEFAULT_SETTINGS.workDayHours,
  );
  if (result.status !== "ok") {
    return result;
  }

  db.tasks[id] = result.task;
  if (result.task !== existing) {
    appendActivity(db, {
      entityType: "task",
      entityId: id,
      action: TIMER_ACTIVITY_ACTION[action],
      at: now.toISOString(),
      byUserId: userId,
    });
  }
  saveDb(db);
  return result;
}
