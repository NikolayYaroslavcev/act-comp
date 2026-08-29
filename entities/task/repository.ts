import { getDb, saveDb } from "@/shared/lib/db";
import type { Database } from "@/entities/database/schema";
import type { Task } from "@/entities/task/schema";
import type { CreateTaskInput, UpdateTaskInput } from "@/entities/task/requests";
import {
  buildDuplicatedTasks,
  buildTaskDeletionHistoryEntry,
  buildTaskRestorationHistoryEntry,
  canRestoreTask,
  computeParentSyncUpdates,
  detectCycle,
  diffTaskChanges,
  getCascadeUpdates,
  validateParentAssignment,
  type CascadeUpdate,
  type ParentSyncUpdate,
  type TaskHistoryProvider,
} from "@/entities/task/model";

// Naive sequential code, scoped per list. The real TEST-N generator with
// gap-filling (TEST-1, TEST-2 deleted -> TEST-3 stays, next create -> TEST-2)
// lands with full task CRUD later in the plan; this only keeps codes unique for now.
function nextTaskCode(db: Database, listId: string): string {
  const count = Object.values(db.tasks).filter((task) => task.listId === listId).length;
  return `TEST-${count + 1}`;
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

export function createTask(input: CreateTaskInput): Task {
  const db = getDb();
  const task: Task = {
    id: crypto.randomUUID(),
    listId: input.listId,
    code: nextTaskCode(db, input.listId),
    title: input.title,
    description: input.description,
    status: "new",
    priority: input.priority,
    category: input.category,
    tags: input.tags,
    dependsOn: [],
    parentId: input.parentId,
    subtaskIds: [],
    deadline: input.deadline,
    createdAt: new Date().toISOString(),
    estimatedMin: input.estimatedMin,
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

// No real analytics source exists yet (see TaskHistoryProvider's own doc
// comment in entities/task/model.ts) — mirrors the fixture provider used
// there until day 16 of the master-plan wires up a live one.
const noHistoryProvider: TaskHistoryProvider = () => null;

export type UpdateTaskOutcome =
  | { status: "not_found" }
  | { status: "invalid_parent" }
  | { status: "cycle" }
  | { status: "ok"; task: Task; cascade: CascadeUpdate[] };

export function updateTask(
  id: string,
  userId: string,
  patch: UpdateTaskInput,
  now: Date = new Date(),
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

  const updated: Task = { ...candidate, history: [...existing.history, ...changes] };
  db.tasks[id] = updated;

  if (changes.some((change) => change.field === "parentId")) {
    applyParentSyncUpdates(db, computeParentSyncUpdates(id, existing.parentId, updated.parentId, tasksByIdMap(db)));
  }

  let cascade: CascadeUpdate[] = [];
  if (changes.some((change) => change.field === "status")) {
    const listTasksWithUpdated = listTasks(existing.listId, db).map((task) => (task.id === id ? updated : task));
    cascade = getCascadeUpdates(updated, listTasksWithUpdated, noHistoryProvider, now);
  }

  saveDb(db);
  return { status: "ok", task: updated, cascade };
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
export function cloneTask(id: string, now: Date = new Date()): CloneTaskOutcome {
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

  if (existing.parentId !== null) {
    const parent = db.tasks[existing.parentId];
    if (parent && parent.deletedAt === null) {
      applyParentSyncUpdates(db, computeParentSyncUpdates(id, null, existing.parentId, tasksByIdMap(db)));
    }
  }

  saveDb(db);
  return { status: "ok", task: updated };
}
