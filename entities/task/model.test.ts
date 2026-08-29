import { describe, expect, it, vi } from "vitest";
import {
  applyTaskQuery,
  buildDuplicatedTasks,
  buildTaskDeletionHistoryEntry,
  buildTaskRestorationHistoryEntry,
  calculateParentProgress,
  calculatePriority,
  canRestoreTask,
  computeParentSyncUpdates,
  countTasksByStatus,
  DependencyCycleError,
  detectCycle,
  diffTaskChanges,
  filterTasks,
  getCascadeUpdates,
  groupTasksByKanbanColumn,
  applyKanbanStatusOverrides,
  isTaskBlocked,
  isTaskOverdue,
  KANBAN_STATUSES,
  searchTasks,
  selectActiveSubtasks,
  selectVisibleTasks,
  sortTasksForKanbanColumn,
  topoSort,
  validateParentAssignment,
} from "@/entities/task/model";
import type { TaskHistoryProvider } from "@/entities/task/model";
import type { Task } from "@/entities/task/schema";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    listId: "l1",
    code: "TEST-1",
    title: "Task",
    description: "",
    status: "new",
    priority: 1,
    category: null,
    tags: [],
    dependsOn: [],
    parentId: null,
    subtaskIds: [],
    deadline: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    estimatedMin: 0,
    timeSpentMin: 0,
    timerStartedAt: null,
    timerPausedAt: null,
    extensions: [],
    history: [],
    deletedAt: null,
    ...overrides,
  };
}

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}${++counter}`;
}

describe("buildDuplicatedTasks", () => {
  const NOW = "2026-08-27T12:00:00.000Z";

  it("returns an empty array for an empty source", () => {
    expect(buildDuplicatedTasks([], "l2", NOW, makeIdGenerator("new-"))).toEqual([]);
  });

  it("assigns a new id and the new listId to each duplicated task", () => {
    const source = [makeTask({ id: "t1", listId: "l1" })];
    const [duplicate] = buildDuplicatedTasks(source, "l2", NOW, makeIdGenerator("new-"));

    expect(duplicate.id).toBe("new-1");
    expect(duplicate.listId).toBe("l2");
  });

  it("copies content fields verbatim", () => {
    const source = [
      makeTask({
        id: "t1",
        code: "TEST-1",
        title: "Title",
        description: "Desc",
        status: "in_progress",
        priority: 4,
        category: "Backend",
        tags: ["a", "b"],
        deadline: "2026-09-01T00:00:00.000Z",
        estimatedMin: 120,
      }),
    ];
    const [duplicate] = buildDuplicatedTasks(source, "l2", NOW, makeIdGenerator("new-"));

    expect(duplicate.code).toBe("TEST-1");
    expect(duplicate.title).toBe("Title");
    expect(duplicate.description).toBe("Desc");
    expect(duplicate.status).toBe("in_progress");
    expect(duplicate.priority).toBe(4);
    expect(duplicate.category).toBe("Backend");
    expect(duplicate.tags).toEqual(["a", "b"]);
    expect(duplicate.deadline).toBe("2026-09-01T00:00:00.000Z");
    expect(duplicate.estimatedMin).toBe(120);
  });

  it("resets server-owned and runtime fields", () => {
    const source = [
      makeTask({
        id: "t1",
        createdAt: "2020-01-01T00:00:00.000Z",
        timeSpentMin: 300,
        timerStartedAt: "2026-08-27T08:00:00.000Z",
        timerPausedAt: "2026-08-27T09:00:00.000Z",
        extensions: [{ commentId: "c1", addedMin: 30 }],
        history: [{ field: "status", old: "new", new: "in_progress", at: NOW, byUserId: "u1" }],
        deletedAt: null,
      }),
    ];
    const [duplicate] = buildDuplicatedTasks(source, "l2", NOW, makeIdGenerator("new-"));

    expect(duplicate.createdAt).toBe(NOW);
    expect(duplicate.timeSpentMin).toBe(0);
    expect(duplicate.timerStartedAt).toBeNull();
    expect(duplicate.timerPausedAt).toBeNull();
    expect(duplicate.extensions).toEqual([]);
    expect(duplicate.history).toEqual([]);
    expect(duplicate.deletedAt).toBeNull();
  });

  it("excludes soft-deleted source tasks", () => {
    const source = [
      makeTask({ id: "t1", deletedAt: "2026-08-01T00:00:00.000Z" }),
      makeTask({ id: "t2", deletedAt: null }),
    ];
    const duplicates = buildDuplicatedTasks(source, "l2", NOW, makeIdGenerator("new-"));

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].code).toBe(source[1].code);
  });

  it("remaps dependsOn to the new ids of duplicated tasks", () => {
    const source = [
      makeTask({ id: "t1", dependsOn: [] }),
      makeTask({ id: "t2", dependsOn: ["t1"] }),
    ];
    const duplicates = buildDuplicatedTasks(source, "l2", NOW, makeIdGenerator("new-"));
    const [dupT1, dupT2] = duplicates;

    expect(dupT2.dependsOn).toEqual([dupT1.id]);
  });

  it("drops a dependsOn reference to a task that was not duplicated", () => {
    const source = [makeTask({ id: "t1", dependsOn: ["missing"] })];
    const [duplicate] = buildDuplicatedTasks(source, "l2", NOW, makeIdGenerator("new-"));

    expect(duplicate.dependsOn).toEqual([]);
  });

  it("remaps parentId and subtaskIds to the new ids of duplicated tasks", () => {
    const source = [
      makeTask({ id: "t1", subtaskIds: ["t2"] }),
      makeTask({ id: "t2", parentId: "t1" }),
    ];
    const duplicates = buildDuplicatedTasks(source, "l2", NOW, makeIdGenerator("new-"));
    const [dupParent, dupChild] = duplicates;

    expect(dupParent.subtaskIds).toEqual([dupChild.id]);
    expect(dupChild.parentId).toBe(dupParent.id);
  });

  it("clears parentId when the parent task was not duplicated", () => {
    const source = [makeTask({ id: "t2", parentId: "missing-parent" })];
    const [duplicate] = buildDuplicatedTasks(source, "l2", NOW, makeIdGenerator("new-"));

    expect(duplicate.parentId).toBeNull();
  });

  it("does not mutate the source tasks", () => {
    const source = [makeTask({ id: "t1", tags: ["a"], dependsOn: [] })];
    const snapshot = structuredClone(source);

    buildDuplicatedTasks(source, "l2", NOW, makeIdGenerator("new-"));

    expect(source).toEqual(snapshot);
  });
});

describe("selectVisibleTasks", () => {
  it("keeps tasks whose listId is in the visible set", () => {
    const task = makeTask({ id: "t1", listId: "l1" });
    expect(selectVisibleTasks([task], new Set(["l1"]))).toEqual([task]);
  });

  it("excludes tasks whose listId is not in the visible set", () => {
    const task = makeTask({ id: "t1", listId: "l-other" });
    expect(selectVisibleTasks([task], new Set(["l1"]))).toEqual([]);
  });

  it("excludes soft-deleted tasks even when their list is visible", () => {
    const task = makeTask({ id: "t1", listId: "l1", deletedAt: "2026-08-01T00:00:00.000Z" });
    expect(selectVisibleTasks([task], new Set(["l1"]))).toEqual([]);
  });

  it("returns an empty array when the visible set is empty", () => {
    const task = makeTask({ id: "t1", listId: "l1" });
    expect(selectVisibleTasks([task], new Set())).toEqual([]);
  });
});

describe("countTasksByStatus", () => {
  it("returns zero counts for every status when there are no tasks", () => {
    expect(countTasksByStatus([])).toEqual({ new: 0, in_progress: 0, done: 0 });
  });

  it("counts tasks per status", () => {
    const tasks = [
      makeTask({ id: "t1", status: "new" }),
      makeTask({ id: "t2", status: "new" }),
      makeTask({ id: "t3", status: "in_progress" }),
      makeTask({ id: "t4", status: "done" }),
    ];

    expect(countTasksByStatus(tasks)).toEqual({ new: 2, in_progress: 1, done: 1 });
  });
});

describe("isTaskOverdue", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("returns false when there is no deadline", () => {
    expect(isTaskOverdue(makeTask({ deadline: null }), NOW)).toBe(false);
  });

  it("returns false when the deadline is in the future", () => {
    const task = makeTask({ deadline: "2026-08-28T12:00:00.000Z", status: "in_progress" });
    expect(isTaskOverdue(task, NOW)).toBe(false);
  });

  it("returns true when the deadline has passed and the task is not done", () => {
    const task = makeTask({ deadline: "2026-08-26T12:00:00.000Z", status: "in_progress" });
    expect(isTaskOverdue(task, NOW)).toBe(true);
  });

  it("returns false for a done task even if the deadline has passed", () => {
    const task = makeTask({ deadline: "2026-08-26T12:00:00.000Z", status: "done" });
    expect(isTaskOverdue(task, NOW)).toBe(false);
  });
});

describe("calculatePriority", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");
  const noHistory: TaskHistoryProvider = () => null;

  it("returns the task's own priority when there is no deadline, no blocked tasks, and no history", () => {
    const task = makeTask({ priority: 3 });
    expect(calculatePriority(task, [task], noHistory, NOW)).toBe(3);
  });

  it("returns the minimum priority (1) unmodified in the base case", () => {
    const task = makeTask({ priority: 1 });
    expect(calculatePriority(task, [task], noHistory, NOW)).toBe(1);
  });

  it("boosts an overdue task by 10", () => {
    const task = makeTask({ priority: 2, status: "in_progress", deadline: "2026-08-20T00:00:00.000Z" });
    expect(calculatePriority(task, [task], noHistory, NOW)).toBe(12);
  });

  it("boosts a task due within 24 hours by 5", () => {
    const task = makeTask({
      priority: 2,
      status: "in_progress",
      deadline: "2026-08-28T00:00:00.000Z",
    });
    expect(calculatePriority(task, [task], noHistory, NOW)).toBe(7);
  });

  it("boosts a task due within 3 days (but beyond 24h) by 2", () => {
    const task = makeTask({
      priority: 2,
      status: "in_progress",
      deadline: "2026-08-30T00:00:00.000Z",
    });
    expect(calculatePriority(task, [task], noHistory, NOW)).toBe(4);
  });

  it("does not boost a task whose deadline is more than 3 days away", () => {
    const task = makeTask({
      priority: 2,
      status: "in_progress",
      deadline: "2026-09-05T00:00:00.000Z",
    });
    expect(calculatePriority(task, [task], noHistory, NOW)).toBe(2);
  });

  it("boosts a task that blocks another open task by 5", () => {
    const blocker = makeTask({ id: "t1", priority: 2, status: "new" });
    const blocked = makeTask({ id: "t2", priority: 1, status: "new", dependsOn: ["t1"] });
    expect(calculatePriority(blocker, [blocker, blocked], noHistory, NOW)).toBe(7);
  });

  it("does not boost a task whose only dependent is already done", () => {
    const blocker = makeTask({ id: "t1", priority: 2, status: "new" });
    const blocked = makeTask({ id: "t2", priority: 1, status: "done", dependsOn: ["t1"] });
    expect(calculatePriority(blocker, [blocker, blocked], noHistory, NOW)).toBe(2);
  });

  it("does not boost a task whose only dependent is soft-deleted", () => {
    const blocker = makeTask({ id: "t1", priority: 2, status: "new" });
    const blocked = makeTask({
      id: "t2",
      priority: 1,
      status: "new",
      dependsOn: ["t1"],
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(calculatePriority(blocker, [blocker, blocked], noHistory, NOW)).toBe(2);
  });

  it("treats an empty allTasks list as not blocking anything", () => {
    const task = makeTask({ priority: 2, status: "new" });
    expect(calculatePriority(task, [], noHistory, NOW)).toBe(2);
  });

  it("boosts by 3 when history shows similar tasks historically overran the estimate", () => {
    const task = makeTask({ priority: 2, status: "new", estimatedMin: 60 });
    const history: TaskHistoryProvider = () => ({ averageActualMinutes: 90 });
    expect(calculatePriority(task, [task], history, NOW)).toBe(5);
  });

  it("does not boost when history shows similar tasks finished within the estimate", () => {
    const task = makeTask({ priority: 2, status: "new", estimatedMin: 60 });
    const history: TaskHistoryProvider = () => ({ averageActualMinutes: 60 });
    expect(calculatePriority(task, [task], history, NOW)).toBe(2);
  });

  it("does not call the history provider when the task has no estimate", () => {
    const task = makeTask({ priority: 2, status: "new", estimatedMin: 0 });
    const history = vi.fn(() => ({ averageActualMinutes: 999 }));
    expect(calculatePriority(task, [task], history, NOW)).toBe(2);
    expect(history).not.toHaveBeenCalled();
  });

  it("ignores deadline, dependency, and history boosts for a done task", () => {
    const done = makeTask({
      id: "t1",
      priority: 2,
      status: "done",
      deadline: "2026-08-01T00:00:00.000Z",
      estimatedMin: 60,
    });
    const blocked = makeTask({ id: "t2", priority: 1, status: "new", dependsOn: ["t1"] });
    const history: TaskHistoryProvider = () => ({ averageActualMinutes: 999 });
    expect(calculatePriority(done, [done, blocked], history, NOW)).toBe(2);
  });

  it("combines deadline, dependency, and history boosts", () => {
    const blocker = makeTask({
      id: "t1",
      priority: 5,
      status: "new",
      deadline: "2026-08-20T00:00:00.000Z",
      estimatedMin: 60,
    });
    const blocked = makeTask({ id: "t2", priority: 1, status: "new", dependsOn: ["t1"] });
    const history: TaskHistoryProvider = () => ({ averageActualMinutes: 90 });
    expect(calculatePriority(blocker, [blocker, blocked], history, NOW)).toBe(23);
  });

  it("defaults `now` to the current time when omitted", () => {
    const task = makeTask({ priority: 3, status: "new" });
    expect(calculatePriority(task, [task], noHistory)).toBe(3);
  });

  it("is deterministic for the same inputs", () => {
    const task = makeTask({ priority: 3, status: "new", deadline: "2026-08-20T00:00:00.000Z" });
    const first = calculatePriority(task, [task], noHistory, NOW);
    const second = calculatePriority(task, [task], noHistory, NOW);
    expect(first).toBe(second);
  });

  it("does not mutate the task", () => {
    const task = makeTask({ priority: 3, status: "new", deadline: "2026-08-20T00:00:00.000Z" });
    const snapshot = structuredClone(task);

    calculatePriority(task, [task], noHistory, NOW);

    expect(task).toEqual(snapshot);
  });

  it("does not mutate allTasks", () => {
    const blocker = makeTask({ id: "t1", priority: 2, status: "new" });
    const blocked = makeTask({ id: "t2", priority: 1, status: "new", dependsOn: ["t1"] });
    const tasks = [blocker, blocked];
    const snapshot = structuredClone(tasks);

    calculatePriority(blocker, tasks, noHistory, NOW);

    expect(tasks).toEqual(snapshot);
  });
});

describe("detectCycle", () => {
  it("returns false for an empty graph", () => {
    expect(detectCycle([])).toBe(false);
  });

  it("returns false for a single task without dependencies", () => {
    const task = makeTask({ id: "a" });
    expect(detectCycle([task])).toBe(false);
  });

  it("returns false for a linear chain A depends on B depends on C", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", dependsOn: ["c"] });
    const c = makeTask({ id: "c" });
    expect(detectCycle([a, b, c])).toBe(false);
  });

  it("returns false for several independent chains", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b" });
    const x = makeTask({ id: "x", dependsOn: ["y"] });
    const y = makeTask({ id: "y" });
    expect(detectCycle([a, b, x, y])).toBe(false);
  });

  it("returns false for a diamond graph", () => {
    const a = makeTask({ id: "a", dependsOn: ["b", "c"] });
    const b = makeTask({ id: "b", dependsOn: ["d"] });
    const c = makeTask({ id: "c", dependsOn: ["d"] });
    const d = makeTask({ id: "d" });
    expect(detectCycle([a, b, c, d])).toBe(false);
  });

  it("returns true for a direct cycle A depends on B depends on A", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", dependsOn: ["a"] });
    expect(detectCycle([a, b])).toBe(true);
  });

  it("returns true for a longer cycle A -> B -> C -> A", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", dependsOn: ["c"] });
    const c = makeTask({ id: "c", dependsOn: ["a"] });
    expect(detectCycle([a, b, c])).toBe(true);
  });

  it("returns true for a self-dependency", () => {
    const a = makeTask({ id: "a", dependsOn: ["a"] });
    expect(detectCycle([a])).toBe(true);
  });

  it("returns true when a cycle exists in only one component of a disconnected graph", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", dependsOn: ["a"] });
    const x = makeTask({ id: "x", dependsOn: ["y"] });
    const y = makeTask({ id: "y" });
    expect(detectCycle([a, b, x, y])).toBe(true);
  });

  it("does not treat a dependency on a missing task id as a cycle", () => {
    const a = makeTask({ id: "a", dependsOn: ["missing"] });
    expect(detectCycle([a])).toBe(false);
  });

  it("does not mutate the input tasks or array", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b" });
    const tasks = [a, b];
    const snapshot = structuredClone(tasks);

    detectCycle(tasks);

    expect(tasks).toEqual(snapshot);
  });
});

describe("topoSort", () => {
  it("returns an empty array for an empty graph", () => {
    expect(topoSort([])).toEqual([]);
  });

  it("returns the single task for a graph with one task", () => {
    const task = makeTask({ id: "a" });
    expect(topoSort([task])).toEqual([task]);
  });

  it("places the dependency before the dependent task (dependsOn direction)", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b" });
    const order = topoSort([a, b]).map((t) => t.id);
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("a"));
  });

  it("orders a linear chain A depends on B depends on C as C, B, A", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", dependsOn: ["c"] });
    const c = makeTask({ id: "c" });
    expect(topoSort([a, b, c]).map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("produces the same valid order regardless of input ordering", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", dependsOn: ["c"] });
    const c = makeTask({ id: "c" });
    expect(topoSort([c, b, a]).map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("preserves the input array order for independent tasks", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b" });
    const c = makeTask({ id: "c" });
    expect(topoSort([c, a, b]).map((t) => t.id)).toEqual(["c", "a", "b"]);
  });

  it("orders a diamond graph so shared dependency comes before both branches", () => {
    const a = makeTask({ id: "a", dependsOn: ["b", "c"] });
    const b = makeTask({ id: "b", dependsOn: ["d"] });
    const c = makeTask({ id: "c", dependsOn: ["d"] });
    const d = makeTask({ id: "d" });
    const order = topoSort([a, b, c, d]).map((t) => t.id);

    expect(order.indexOf("d")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("d")).toBeLessThan(order.indexOf("c"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("a"));
    expect(order.indexOf("c")).toBeLessThan(order.indexOf("a"));
  });

  it("is deterministic across repeated calls with the same input", () => {
    const a = makeTask({ id: "a", dependsOn: ["b", "c"] });
    const b = makeTask({ id: "b", dependsOn: ["d"] });
    const c = makeTask({ id: "c", dependsOn: ["d"] });
    const d = makeTask({ id: "d" });
    const tasks = [a, b, c, d];

    const first = topoSort(tasks).map((t) => t.id);
    const second = topoSort(tasks).map((t) => t.id);

    expect(first).toEqual(second);
  });

  it("throws DependencyCycleError for a self-dependency", () => {
    const a = makeTask({ id: "a", dependsOn: ["a"] });
    expect(() => topoSort([a])).toThrow(DependencyCycleError);
  });

  it("throws DependencyCycleError for an ordinary cycle", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", dependsOn: ["a"] });
    expect(() => topoSort([a, b])).toThrow(DependencyCycleError);
  });

  it("ignores a dependency on a missing task id instead of fabricating an entry", () => {
    const a = makeTask({ id: "a", dependsOn: ["missing"] });
    expect(topoSort([a]).map((t) => t.id)).toEqual(["a"]);
  });

  it("does not mutate the input tasks or array", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b" });
    const tasks = [a, b];
    const snapshot = structuredClone(tasks);

    topoSort(tasks);

    expect(tasks).toEqual(snapshot);
  });
});

describe("getCascadeUpdates", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");
  const noHistory: TaskHistoryProvider = () => null;

  it("returns an empty array when the changed task has no dependents", () => {
    const task = makeTask({ id: "a" });
    expect(getCascadeUpdates(task, [task], noHistory, NOW)).toEqual([]);
  });

  it("returns an empty array when other tasks exist but none depend on the changed task", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b" });
    expect(getCascadeUpdates(a, [a, b], noHistory, NOW)).toEqual([]);
  });

  it("returns one update for a single direct dependent", () => {
    const b = makeTask({ id: "b", status: "done" });
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const result = getCascadeUpdates(b, [a, b], noHistory, NOW);

    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe("a");
  });

  it("returns one update per direct dependent when several tasks depend on the changed one", () => {
    const c = makeTask({ id: "c", status: "done" });
    const a = makeTask({ id: "a", dependsOn: ["c"] });
    const b = makeTask({ id: "b", dependsOn: ["c"] });
    const result = getCascadeUpdates(c, [a, b, c], noHistory, NOW);

    expect(result.map((u) => u.taskId).sort()).toEqual(["a", "b"]);
  });

  it("cascades through a chain when the root of the chain changes (A depends on B depends on C)", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", dependsOn: ["c"] });
    const c = makeTask({ id: "c", status: "done" });
    const result = getCascadeUpdates(c, [a, b, c], noHistory, NOW);

    expect(result.map((u) => u.taskId)).toEqual(["b", "a"]);
  });

  it("only cascades to the tasks above the changed task in the chain, not below it", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", dependsOn: ["c"], status: "done" });
    const c = makeTask({ id: "c" });
    const result = getCascadeUpdates(b, [a, b, c], noHistory, NOW);

    expect(result.map((u) => u.taskId)).toEqual(["a"]);
  });

  it("respects dependency direction: changing the dependency affects the dependent, not the other way around", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b" });

    expect(getCascadeUpdates(b, [a, b], noHistory, NOW).map((u) => u.taskId)).toEqual(["a"]);
    expect(getCascadeUpdates(a, [a, b], noHistory, NOW)).toEqual([]);
  });

  it("leaves independent tasks untouched", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", status: "done" });
    const x = makeTask({ id: "x" });
    const result = getCascadeUpdates(b, [a, b, x], noHistory, NOW);

    expect(result.map((u) => u.taskId)).toEqual(["a"]);
  });

  it("does not fabricate an update for a dependency on a missing task id", () => {
    const a = makeTask({ id: "a", dependsOn: ["missing"] });
    expect(getCascadeUpdates(a, [a], noHistory, NOW)).toEqual([]);
  });

  it("ignores a missing dependency when computing isBlocked for a real dependent", () => {
    const a = makeTask({ id: "a", dependsOn: ["missing", "b"] });
    const b = makeTask({ id: "b", status: "done" });
    const [update] = getCascadeUpdates(b, [a, b], noHistory, NOW);

    expect(update.isBlocked).toBe(false);
  });

  it("throws DependencyCycleError instead of returning a cascade when the graph has a cycle", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", dependsOn: ["a"] });

    expect(() => getCascadeUpdates(a, [a, b], noHistory, NOW)).toThrow(DependencyCycleError);
  });

  it("is deterministic for the same input", () => {
    const a = makeTask({ id: "a", dependsOn: ["b", "c"] });
    const b = makeTask({ id: "b", dependsOn: ["d"] });
    const c = makeTask({ id: "c", dependsOn: ["d"] });
    const d = makeTask({ id: "d", status: "done" });
    const tasks = [a, b, c, d];

    const first = getCascadeUpdates(d, tasks, noHistory, NOW).map((u) => u.taskId);
    const second = getCascadeUpdates(d, tasks, noHistory, NOW).map((u) => u.taskId);

    expect(first).toEqual(second);
  });

  it("orders a diamond graph so shared dependents come out in topological order", () => {
    const a = makeTask({ id: "a", dependsOn: ["b", "c"] });
    const b = makeTask({ id: "b", dependsOn: ["d"] });
    const c = makeTask({ id: "c", dependsOn: ["d"] });
    const d = makeTask({ id: "d", status: "done" });
    const result = getCascadeUpdates(d, [a, b, c, d], noHistory, NOW).map((u) => u.taskId);

    expect(result.indexOf("b")).toBeLessThan(result.indexOf("a"));
    expect(result.indexOf("c")).toBeLessThan(result.indexOf("a"));
    expect(result).toHaveLength(3);
  });

  it("does not mutate the changed task or allTasks", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", status: "done" });
    const tasks = [a, b];
    const snapshot = structuredClone(tasks);

    getCascadeUpdates(b, tasks, noHistory, NOW);

    expect(tasks).toEqual(snapshot);
  });

  it("returns new objects rather than references into allTasks", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", status: "done" });
    const [update] = getCascadeUpdates(b, [a, b], noHistory, NOW);

    expect(update).not.toBe(a);
  });

  it("marks a dependent as blocked while its dependency is not done", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", status: "in_progress" });
    const [update] = getCascadeUpdates(b, [a, b], noHistory, NOW);

    expect(update.isBlocked).toBe(true);
  });

  it("marks a dependent as unblocked once its dependency is done", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", status: "done" });
    const [update] = getCascadeUpdates(b, [a, b], noHistory, NOW);

    expect(update.isBlocked).toBe(false);
  });

  it("keeps a dependent blocked in a diamond graph until every branch is done", () => {
    const a = makeTask({ id: "a", dependsOn: ["b", "c"] });
    const b = makeTask({ id: "b", dependsOn: ["d"], status: "done" });
    const c = makeTask({ id: "c", dependsOn: ["d"], status: "new" });
    const d = makeTask({ id: "d", status: "done" });
    const result = getCascadeUpdates(d, [a, b, c, d], noHistory, NOW);
    const aUpdate = result.find((u) => u.taskId === "a")!;

    expect(aUpdate.isBlocked).toBe(true);
  });

  it("does not treat a soft-deleted dependency as blocking", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({
      id: "b",
      status: "new",
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    const [update] = getCascadeUpdates(b, [a, b], noHistory, NOW);

    expect(update.isBlocked).toBe(false);
  });

  it("excludes a soft-deleted dependent from the cascade", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"], deletedAt: "2026-08-01T00:00:00.000Z" });
    const b = makeTask({ id: "b", status: "done" });
    expect(getCascadeUpdates(b, [a, b], noHistory, NOW)).toEqual([]);
  });

  it("recalculates priority for each dependent using the existing calculatePriority function", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"], priority: 2, status: "new" });
    const b = makeTask({ id: "b", status: "done" });
    const [update] = getCascadeUpdates(b, [a, b], noHistory, NOW);

    expect(update.recalculatedPriority).toBe(calculatePriority(a, [a, b], noHistory, NOW));
  });

  it("passes the historyProvider through to the underlying priority calculation", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"], priority: 2, status: "new", estimatedMin: 60 });
    const b = makeTask({ id: "b", status: "done" });
    const history: TaskHistoryProvider = vi.fn(() => ({ averageActualMinutes: 90 }));
    const [update] = getCascadeUpdates(b, [a, b], history, NOW);

    expect(update.recalculatedPriority).toBe(5);
    expect(history).toHaveBeenCalled();
  });
});

describe("diffTaskChanges", () => {
  const AT = "2026-08-27T12:00:00.000Z";

  it("returns no changes for an empty patch", () => {
    const task = makeTask({ title: "Task" });
    expect(diffTaskChanges(task, {}, "u1", AT)).toEqual([]);
  });

  it("returns no changes when the patched value equals the existing value (no-op)", () => {
    const task = makeTask({ title: "Task" });
    expect(diffTaskChanges(task, { title: "Task" }, "u1", AT)).toEqual([]);
  });

  it("records old and new values, byUserId, and timestamp for a single changed field", () => {
    const task = makeTask({ priority: 2 });
    expect(diffTaskChanges(task, { priority: 4 }, "u1", AT)).toEqual([
      { field: "priority", old: 2, new: 4, at: AT, byUserId: "u1" },
    ]);
  });

  it("records one entry per field when several fields change", () => {
    const task = makeTask({ title: "Old", priority: 2 });
    const changes = diffTaskChanges(task, { title: "New", priority: 4 }, "u1", AT);

    expect(changes).toEqual([
      { field: "title", old: "Old", new: "New", at: AT, byUserId: "u1" },
      { field: "priority", old: 2, new: 4, at: AT, byUserId: "u1" },
    ]);
  });

  it("treats an array field with the same content as unchanged (no-op), not a reference-inequality change", () => {
    const task = makeTask({ tags: ["a", "b"] });
    expect(diffTaskChanges(task, { tags: ["a", "b"] }, "u1", AT)).toEqual([]);
  });

  it("records a change for an array field whose content differs", () => {
    const task = makeTask({ dependsOn: ["b"] });
    expect(diffTaskChanges(task, { dependsOn: ["c"] }, "u1", AT)).toEqual([
      { field: "dependsOn", old: ["b"], new: ["c"], at: AT, byUserId: "u1" },
    ]);
  });

  it("treats an explicit null as a change from a non-null value", () => {
    const task = makeTask({ deadline: "2026-09-01T00:00:00.000Z" });
    expect(diffTaskChanges(task, { deadline: null }, "u1", AT)).toEqual([
      { field: "deadline", old: "2026-09-01T00:00:00.000Z", new: null, at: AT, byUserId: "u1" },
    ]);
  });
});

describe("buildTaskDeletionHistoryEntry", () => {
  it("describes deletedAt moving from null to the given timestamp", () => {
    const task = makeTask({ deletedAt: null });
    const at = "2026-08-27T12:00:00.000Z";

    const entry = buildTaskDeletionHistoryEntry(task, "u1", at);

    expect(entry).toEqual({ field: "deletedAt", old: null, new: at, at, byUserId: "u1" });
  });
});

describe("canRestoreTask", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function daysBefore(reference: Date, days: number): string {
    return new Date(reference.getTime() - days * MS_PER_DAY).toISOString();
  }

  it("allows restore after 29 days since deletion", () => {
    const task = makeTask({ deletedAt: daysBefore(NOW, 29) });
    expect(canRestoreTask(task, NOW)).toBe(true);
  });

  it("allows restore after exactly 30 days since deletion", () => {
    const task = makeTask({ deletedAt: daysBefore(NOW, 30) });
    expect(canRestoreTask(task, NOW)).toBe(true);
  });

  it("denies restore after 31 days since deletion", () => {
    const task = makeTask({ deletedAt: daysBefore(NOW, 31) });
    expect(canRestoreTask(task, NOW)).toBe(false);
  });

  it("denies restore a few hours past the 30-day window", () => {
    const deletedAt = new Date(NOW.getTime() - 30 * MS_PER_DAY - 60 * 60 * 1000).toISOString();
    const task = makeTask({ deletedAt });
    expect(canRestoreTask(task, NOW)).toBe(false);
  });

  it("denies restore when the task was never deleted", () => {
    const task = makeTask({ deletedAt: null });
    expect(canRestoreTask(task, NOW)).toBe(false);
  });

  it("uses the given `now` instead of the current time", () => {
    const deletedAt = daysBefore(NOW, 10);
    const task = makeTask({ deletedAt });
    const farFuture = new Date(NOW.getTime() + 100 * MS_PER_DAY);
    expect(canRestoreTask(task, farFuture)).toBe(false);
  });

  it("is deterministic for the same explicit `now`", () => {
    const task = makeTask({ deletedAt: daysBefore(NOW, 30) });
    expect(canRestoreTask(task, NOW)).toBe(canRestoreTask(task, NOW));
  });
});

describe("buildTaskRestorationHistoryEntry", () => {
  it("describes deletedAt moving from the deleted timestamp back to null", () => {
    const deletedAt = "2026-08-01T00:00:00.000Z";
    const task = makeTask({ deletedAt });
    const at = "2026-08-27T12:00:00.000Z";

    const entry = buildTaskRestorationHistoryEntry(task, "u1", at);

    expect(entry).toEqual({ field: "deletedAt", old: deletedAt, new: null, at, byUserId: "u1" });
  });
});

function byId(tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map((task) => [task.id, task]));
}

describe("validateParentAssignment", () => {
  it("accepts a parent in the same list", () => {
    const parent = makeTask({ id: "p1", listId: "l1" });
    const child = makeTask({ id: "c1", listId: "l1" });

    expect(validateParentAssignment(child, "p1", byId([parent, child]))).toBeNull();
  });

  it("rejects assigning a task as its own parent", () => {
    const child = makeTask({ id: "c1", listId: "l1" });

    expect(validateParentAssignment(child, "c1", byId([child]))).toBe("self");
  });

  it("rejects a parentId that does not reference an existing task", () => {
    const child = makeTask({ id: "c1", listId: "l1" });

    expect(validateParentAssignment(child, "missing", byId([child]))).toBe("not_found");
  });

  it("rejects a soft-deleted parent", () => {
    const parent = makeTask({ id: "p1", listId: "l1", deletedAt: "2026-08-01T00:00:00.000Z" });
    const child = makeTask({ id: "c1", listId: "l1" });

    expect(validateParentAssignment(child, "p1", byId([parent, child]))).toBe("deleted");
  });

  it("rejects a parent that belongs to a different list", () => {
    const parent = makeTask({ id: "p1", listId: "other-list" });
    const child = makeTask({ id: "c1", listId: "l1" });

    expect(validateParentAssignment(child, "p1", byId([parent, child]))).toBe("different_list");
  });

  it("rejects a direct cycle (assigning a subtask's own subtask as its parent)", () => {
    const grandparent = makeTask({ id: "gp", listId: "l1" });
    const parent = makeTask({ id: "p1", listId: "l1", parentId: "gp" });
    const child = makeTask({ id: "c1", listId: "l1", parentId: "p1" });

    const result = validateParentAssignment(grandparent, "c1", byId([grandparent, parent, child]));

    expect(result).toBe("cycle");
  });

  it("rejects an indirect cycle several levels deep", () => {
    const a = makeTask({ id: "a", listId: "l1" });
    const b = makeTask({ id: "b", listId: "l1", parentId: "a" });
    const c = makeTask({ id: "c", listId: "l1", parentId: "b" });
    const d = makeTask({ id: "d", listId: "l1", parentId: "c" });

    const result = validateParentAssignment(a, "d", byId([a, b, c, d]));

    expect(result).toBe("cycle");
  });

  it("allows re-parenting to an unrelated task that is not an ancestor", () => {
    const a = makeTask({ id: "a", listId: "l1" });
    const b = makeTask({ id: "b", listId: "l1" });
    const c = makeTask({ id: "c", listId: "l1", parentId: "a" });

    expect(validateParentAssignment(c, "b", byId([a, b, c]))).toBeNull();
  });
});

describe("computeParentSyncUpdates", () => {
  it("adds the child id to the new parent's subtaskIds when first assigned", () => {
    const parent = makeTask({ id: "p1", subtaskIds: [] });
    const child = makeTask({ id: "c1", parentId: null });

    const updates = computeParentSyncUpdates(child.id, null, "p1", byId([parent, child]));

    expect(updates).toEqual([{ taskId: "p1", subtaskIds: ["c1"] }]);
  });

  it("removes the child id from the old parent and adds it to the new parent when re-parenting", () => {
    const oldParent = makeTask({ id: "old", subtaskIds: ["c1"] });
    const newParent = makeTask({ id: "new", subtaskIds: [] });
    const child = makeTask({ id: "c1", parentId: "old" });

    const updates = computeParentSyncUpdates(child.id, "old", "new", byId([oldParent, newParent, child]));

    expect(updates).toEqual(
      expect.arrayContaining([
        { taskId: "old", subtaskIds: [] },
        { taskId: "new", subtaskIds: ["c1"] },
      ]),
    );
    expect(updates).toHaveLength(2);
  });

  it("removes the child id from the old parent when the parent is cleared", () => {
    const oldParent = makeTask({ id: "old", subtaskIds: ["c1", "c2"] });
    const child = makeTask({ id: "c1", parentId: "old" });

    const updates = computeParentSyncUpdates(child.id, "old", null, byId([oldParent, child]));

    expect(updates).toEqual([{ taskId: "old", subtaskIds: ["c2"] }]);
  });

  it("does not duplicate the child id if it is already present in the new parent's subtaskIds", () => {
    const parent = makeTask({ id: "p1", subtaskIds: ["c1"] });
    const child = makeTask({ id: "c1", parentId: null });

    const updates = computeParentSyncUpdates(child.id, null, "p1", byId([parent, child]));

    expect(updates).toEqual([]);
  });

  it("returns no updates when the parent id does not actually change", () => {
    const parent = makeTask({ id: "p1", subtaskIds: ["c1"] });
    const child = makeTask({ id: "c1", parentId: "p1" });

    const updates = computeParentSyncUpdates(child.id, "p1", "p1", byId([parent, child]));

    expect(updates).toEqual([]);
  });

  it("skips a side whose task id cannot be found, without throwing", () => {
    const child = makeTask({ id: "c1", parentId: "missing-old" });

    const updates = computeParentSyncUpdates(child.id, "missing-old", "missing-new", byId([child]));

    expect(updates).toEqual([]);
  });
});

describe("selectActiveSubtasks", () => {
  it("returns an empty array when the parent has no subtasks", () => {
    const parent = makeTask({ id: "p1", subtaskIds: [] });

    expect(selectActiveSubtasks(parent, [parent])).toEqual([]);
  });

  it("resolves subtaskIds to their task objects in order", () => {
    const c1 = makeTask({ id: "c1", code: "TEST-2" });
    const c2 = makeTask({ id: "c2", code: "TEST-3" });
    const parent = makeTask({ id: "p1", subtaskIds: ["c1", "c2"] });

    expect(selectActiveSubtasks(parent, [parent, c1, c2])).toEqual([c1, c2]);
  });

  it("excludes soft-deleted subtasks", () => {
    const c1 = makeTask({ id: "c1", deletedAt: "2026-08-01T00:00:00.000Z" });
    const c2 = makeTask({ id: "c2" });
    const parent = makeTask({ id: "p1", subtaskIds: ["c1", "c2"] });

    expect(selectActiveSubtasks(parent, [parent, c1, c2])).toEqual([c2]);
  });

  it("ignores subtaskIds that no longer resolve to a task", () => {
    const parent = makeTask({ id: "p1", subtaskIds: ["missing"] });

    expect(selectActiveSubtasks(parent, [parent])).toEqual([]);
  });
});

describe("calculateParentProgress", () => {
  it("returns null when the parent has no subtasks", () => {
    const parent = makeTask({ id: "p1", subtaskIds: [] });

    expect(calculateParentProgress(parent, [parent])).toBeNull();
  });

  it("returns null when every referenced subtask has been soft-deleted", () => {
    const child = makeTask({ id: "c1", status: "done", deletedAt: "2026-08-01T00:00:00.000Z" });
    const parent = makeTask({ id: "p1", subtaskIds: ["c1"] });

    expect(calculateParentProgress(parent, [parent, child])).toBeNull();
  });

  it("reports 100% for a single done subtask", () => {
    const child = makeTask({ id: "c1", status: "done" });
    const parent = makeTask({ id: "p1", subtaskIds: ["c1"] });

    expect(calculateParentProgress(parent, [parent, child])).toEqual({ total: 1, done: 1, percent: 100 });
  });

  it("reports 0% for a single not-done subtask", () => {
    const child = makeTask({ id: "c1", status: "new" });
    const parent = makeTask({ id: "p1", subtaskIds: ["c1"] });

    expect(calculateParentProgress(parent, [parent, child])).toEqual({ total: 1, done: 0, percent: 0 });
  });

  it("computes a mixed percentage across active subtasks, ignoring deleted ones", () => {
    const c1 = makeTask({ id: "c1", status: "done" });
    const c2 = makeTask({ id: "c2", status: "in_progress" });
    const c3 = makeTask({ id: "c3", status: "done" });
    const c4 = makeTask({ id: "c4", status: "done", deletedAt: "2026-08-01T00:00:00.000Z" });
    const parent = makeTask({ id: "p1", subtaskIds: ["c1", "c2", "c3", "c4"] });

    expect(calculateParentProgress(parent, [parent, c1, c2, c3, c4])).toEqual({ total: 3, done: 2, percent: 67 });
  });

  it("reports 100% when all active subtasks are done", () => {
    const c1 = makeTask({ id: "c1", status: "done" });
    const c2 = makeTask({ id: "c2", status: "done" });
    const parent = makeTask({ id: "p1", subtaskIds: ["c1", "c2"] });

    expect(calculateParentProgress(parent, [parent, c1, c2])).toEqual({ total: 2, done: 2, percent: 100 });
  });

  it("does not mutate the parent or the given task list", () => {
    const child = makeTask({ id: "c1", status: "done" });
    const parent = makeTask({ id: "p1", subtaskIds: ["c1"] });
    const tasks = [parent, child];
    const snapshot = structuredClone(tasks);

    calculateParentProgress(parent, tasks);

    expect(tasks).toEqual(snapshot);
  });
});

describe("searchTasks", () => {
  it("returns all tasks unchanged for an empty query", () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    expect(searchTasks(tasks, "")).toEqual(tasks);
  });

  it("returns all tasks unchanged for a whitespace-only query", () => {
    const tasks = [makeTask({ id: "t1" })];
    expect(searchTasks(tasks, "   ")).toEqual(tasks);
  });

  it("does not mutate the input array", () => {
    const tasks = [makeTask({ id: "t1", title: "Написать тесты" })];
    const snapshot = [...tasks];
    searchTasks(tasks, "тесты");
    expect(tasks).toEqual(snapshot);
  });

  it("is case-insensitive", () => {
    const tasks = [makeTask({ id: "t1", title: "Write Tests" })];
    expect(searchTasks(tasks, "WRITE")).toHaveLength(1);
    expect(searchTasks(tasks, "write")).toHaveLength(1);
  });

  it("matches on code", () => {
    const tasks = [makeTask({ id: "t1", code: "TEST-42" }), makeTask({ id: "t2", code: "TEST-7" })];
    expect(searchTasks(tasks, "test-42")).toEqual([tasks[0]]);
  });

  it("matches on title", () => {
    const tasks = [makeTask({ id: "t1", title: "Deploy service" }), makeTask({ id: "t2", title: "Write docs" })];
    expect(searchTasks(tasks, "deploy")).toEqual([tasks[0]]);
  });

  it("matches on description", () => {
    const tasks = [makeTask({ id: "t1", description: "Uses the payment gateway" })];
    expect(searchTasks(tasks, "gateway")).toEqual(tasks);
  });

  it("matches on category", () => {
    const tasks = [makeTask({ id: "t1", category: "Backend" }), makeTask({ id: "t2", category: "Frontend" })];
    expect(searchTasks(tasks, "back")).toEqual([tasks[0]]);
  });

  it("matches on tags", () => {
    const tasks = [makeTask({ id: "t1", tags: ["urgent", "billing"] }), makeTask({ id: "t2", tags: ["docs"] })];
    expect(searchTasks(tasks, "billing")).toEqual([tasks[0]]);
  });

  it("tolerates a null category without throwing", () => {
    const tasks = [makeTask({ id: "t1", category: null })];
    expect(() => searchTasks(tasks, "anything")).not.toThrow();
    expect(searchTasks(tasks, "anything")).toEqual([]);
  });

  it("returns a task once even if it matches on several fields", () => {
    const tasks = [makeTask({ id: "t1", title: "Payment flow", description: "payment gateway retry" })];
    expect(searchTasks(tasks, "payment")).toHaveLength(1);
  });

  it("returns an empty array when nothing matches", () => {
    const tasks = [makeTask({ id: "t1", title: "Alpha" })];
    expect(searchTasks(tasks, "zzz")).toEqual([]);
  });

  it("preserves the original task order", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Alpha task" }),
      makeTask({ id: "t2", title: "Beta task" }),
      makeTask({ id: "t3", title: "Gamma task" }),
    ];
    expect(searchTasks(tasks, "task").map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });
});

describe("filterTasks", () => {
  it("returns all tasks unchanged when no filter fields are set", () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    expect(filterTasks(tasks, {})).toEqual(tasks);
  });

  it("does not mutate the input array", () => {
    const tasks = [makeTask({ id: "t1", status: "new" })];
    const snapshot = [...tasks];
    filterTasks(tasks, { status: ["done"] });
    expect(tasks).toEqual(snapshot);
  });

  it("filters by a single status", () => {
    const tasks = [makeTask({ id: "t1", status: "new" }), makeTask({ id: "t2", status: "done" })];
    expect(filterTasks(tasks, { status: ["done"] })).toEqual([tasks[1]]);
  });

  it("filters by several statuses (OR within the field)", () => {
    const tasks = [
      makeTask({ id: "t1", status: "new" }),
      makeTask({ id: "t2", status: "in_progress" }),
      makeTask({ id: "t3", status: "done" }),
    ];
    expect(filterTasks(tasks, { status: ["new", "done"] }).map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("filters by category (exact match)", () => {
    const tasks = [makeTask({ id: "t1", category: "Backend" }), makeTask({ id: "t2", category: "Frontend" })];
    expect(filterTasks(tasks, { category: "Backend" })).toEqual([tasks[0]]);
  });

  it("excludes tasks with a null category when a category filter is set", () => {
    const tasks = [makeTask({ id: "t1", category: null })];
    expect(filterTasks(tasks, { category: "Backend" })).toEqual([]);
  });

  it("filters by tags using match-any semantics", () => {
    const tasks = [
      makeTask({ id: "t1", tags: ["urgent"] }),
      makeTask({ id: "t2", tags: ["billing"] }),
      makeTask({ id: "t3", tags: ["docs"] }),
    ];
    expect(filterTasks(tasks, { tags: ["urgent", "billing"] }).map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("filters by priority min only", () => {
    const tasks = [makeTask({ id: "t1", priority: 2 }), makeTask({ id: "t2", priority: 4 })];
    expect(filterTasks(tasks, { priorityMin: 3 })).toEqual([tasks[1]]);
  });

  it("filters by priority max only", () => {
    const tasks = [makeTask({ id: "t1", priority: 2 }), makeTask({ id: "t2", priority: 4 })];
    expect(filterTasks(tasks, { priorityMax: 3 })).toEqual([tasks[0]]);
  });

  it("filters by priority min and max together", () => {
    const tasks = [
      makeTask({ id: "t1", priority: 1 }),
      makeTask({ id: "t2", priority: 3 }),
      makeTask({ id: "t3", priority: 5 }),
    ];
    expect(filterTasks(tasks, { priorityMin: 2, priorityMax: 4 })).toEqual([tasks[1]]);
  });

  it("includes a task whose priority equals both min and max", () => {
    const tasks = [makeTask({ id: "t1", priority: 3 })];
    expect(filterTasks(tasks, { priorityMin: 3, priorityMax: 3 })).toEqual(tasks);
  });

  it("filters by deadline 'from' only", () => {
    const tasks = [
      makeTask({ id: "t1", deadline: "2026-08-01T00:00:00.000Z" }),
      makeTask({ id: "t2", deadline: "2026-09-01T00:00:00.000Z" }),
    ];
    expect(filterTasks(tasks, { deadlineFrom: "2026-08-15T00:00:00.000Z" })).toEqual([tasks[1]]);
  });

  it("filters by deadline 'to' only", () => {
    const tasks = [
      makeTask({ id: "t1", deadline: "2026-08-01T00:00:00.000Z" }),
      makeTask({ id: "t2", deadline: "2026-09-01T00:00:00.000Z" }),
    ];
    expect(filterTasks(tasks, { deadlineTo: "2026-08-15T00:00:00.000Z" })).toEqual([tasks[0]]);
  });

  it("filters by a full deadline range", () => {
    const tasks = [
      makeTask({ id: "t1", deadline: "2026-08-01T00:00:00.000Z" }),
      makeTask({ id: "t2", deadline: "2026-08-15T00:00:00.000Z" }),
      makeTask({ id: "t3", deadline: "2026-09-01T00:00:00.000Z" }),
    ];
    expect(
      filterTasks(tasks, { deadlineFrom: "2026-08-10T00:00:00.000Z", deadlineTo: "2026-08-20T00:00:00.000Z" }),
    ).toEqual([tasks[1]]);
  });

  it("includes a task whose deadline exactly equals equal from/to bounds", () => {
    const tasks = [makeTask({ id: "t1", deadline: "2026-08-15T00:00:00.000Z" })];
    expect(
      filterTasks(tasks, { deadlineFrom: "2026-08-15T00:00:00.000Z", deadlineTo: "2026-08-15T00:00:00.000Z" }),
    ).toEqual(tasks);
  });

  it("never matches a null deadline when a deadline range is set", () => {
    const tasks = [makeTask({ id: "t1", deadline: null })];
    expect(filterTasks(tasks, { deadlineFrom: "2026-01-01T00:00:00.000Z" })).toEqual([]);
  });

  it("combines every active filter with AND", () => {
    const tasks = [
      makeTask({ id: "t1", status: "in_progress", priority: 4, deadline: "2026-08-10T00:00:00.000Z" }),
      makeTask({ id: "t2", status: "in_progress", priority: 1, deadline: "2026-08-10T00:00:00.000Z" }),
      makeTask({ id: "t3", status: "done", priority: 4, deadline: "2026-08-10T00:00:00.000Z" }),
    ];
    expect(
      filterTasks(tasks, { status: ["in_progress"], priorityMin: 3, deadlineTo: "2026-08-31T00:00:00.000Z" }),
    ).toEqual([tasks[0]]);
  });
});

describe("applyTaskQuery", () => {
  it("combines search and filters with AND", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Deploy service", status: "in_progress" }),
      makeTask({ id: "t2", title: "Deploy docs", status: "done" }),
      makeTask({ id: "t3", title: "Write tests", status: "in_progress" }),
    ];
    expect(
      applyTaskQuery(tasks, { search: "deploy", filters: { status: ["in_progress"] } }).map((t) => t.id),
    ).toEqual(["t1"]);
  });

  it("does not mutate the input array", () => {
    const tasks = [makeTask({ id: "t1", title: "Alpha" })];
    const snapshot = [...tasks];
    applyTaskQuery(tasks, { search: "alpha", filters: { priorityMin: 1 } });
    expect(tasks).toEqual(snapshot);
  });
});

describe("isTaskBlocked", () => {
  it("is false when the task has no dependencies", () => {
    const a = makeTask({ id: "a", dependsOn: [] });
    expect(isTaskBlocked(a, new Map([["a", a]]))).toBe(false);
  });

  it("is true when a dependency is not done", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", status: "in_progress" });
    expect(
      isTaskBlocked(
        a,
        new Map([
          ["a", a],
          ["b", b],
        ]),
      ),
    ).toBe(true);
  });

  it("is false once every dependency is done", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", status: "done" });
    expect(
      isTaskBlocked(
        a,
        new Map([
          ["a", a],
          ["b", b],
        ]),
      ),
    ).toBe(false);
  });

  it("ignores a soft-deleted dependency", () => {
    const a = makeTask({ id: "a", dependsOn: ["b"] });
    const b = makeTask({ id: "b", status: "new", deletedAt: "2026-08-01T00:00:00.000Z" });
    expect(
      isTaskBlocked(
        a,
        new Map([
          ["a", a],
          ["b", b],
        ]),
      ),
    ).toBe(false);
  });

  it("ignores a dependency id with no matching task", () => {
    const a = makeTask({ id: "a", dependsOn: ["missing"] });
    expect(isTaskBlocked(a, new Map([["a", a]]))).toBe(false);
  });
});

describe("KANBAN_STATUSES", () => {
  it("lists all task statuses in board order", () => {
    expect(KANBAN_STATUSES).toEqual(["new", "in_progress", "done"]);
  });
});

describe("sortTasksForKanbanColumn", () => {
  it("orders by priority descending", () => {
    const low = makeTask({ id: "low", priority: 1 });
    const high = makeTask({ id: "high", priority: 5 });
    expect(sortTasksForKanbanColumn([low, high]).map((t) => t.id)).toEqual(["high", "low"]);
  });

  it("breaks a priority tie by createdAt ascending", () => {
    const later = makeTask({ id: "later", priority: 3, createdAt: "2026-08-02T00:00:00.000Z" });
    const earlier = makeTask({ id: "earlier", priority: 3, createdAt: "2026-08-01T00:00:00.000Z" });
    expect(sortTasksForKanbanColumn([later, earlier]).map((t) => t.id)).toEqual(["earlier", "later"]);
  });

  it("does not mutate the input array", () => {
    const tasks = [makeTask({ id: "a", priority: 1 }), makeTask({ id: "b", priority: 5 })];
    const snapshot = [...tasks];
    sortTasksForKanbanColumn(tasks);
    expect(tasks).toEqual(snapshot);
  });
});

describe("groupTasksByKanbanColumn", () => {
  it("groups tasks under their status", () => {
    const a = makeTask({ id: "a", status: "new" });
    const b = makeTask({ id: "b", status: "in_progress" });
    const c = makeTask({ id: "c", status: "done" });
    const grouped = groupTasksByKanbanColumn([a, b, c]);
    expect(grouped.new.map((t) => t.id)).toEqual(["a"]);
    expect(grouped.in_progress.map((t) => t.id)).toEqual(["b"]);
    expect(grouped.done.map((t) => t.id)).toEqual(["c"]);
  });

  it("returns an empty array for a status with no tasks", () => {
    const a = makeTask({ id: "a", status: "new" });
    expect(groupTasksByKanbanColumn([a]).done).toEqual([]);
  });

  it("sorts each column using sortTasksForKanbanColumn", () => {
    const low = makeTask({ id: "low", status: "new", priority: 1 });
    const high = makeTask({ id: "high", status: "new", priority: 5 });
    expect(groupTasksByKanbanColumn([low, high]).new.map((t) => t.id)).toEqual(["high", "low"]);
  });

  it("excludes soft-deleted tasks from every column", () => {
    const active = makeTask({ id: "a", status: "new" });
    const deleted = makeTask({
      id: "b",
      status: "new",
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(groupTasksByKanbanColumn([active, deleted]).new.map((t) => t.id)).toEqual(["a"]);
  });
});

describe("applyKanbanStatusOverrides", () => {
  it("applies a status override without mutating the original task", () => {
    const task = makeTask({ id: "a", status: "new" });
    const result = applyKanbanStatusOverrides([task], { a: "in_progress" });
    expect(result[0].status).toBe("in_progress");
    expect(task.status).toBe("new");
  });

  it("leaves tasks without an override unchanged", () => {
    const a = makeTask({ id: "a", status: "new" });
    const b = makeTask({ id: "b", status: "done" });
    expect(applyKanbanStatusOverrides([a, b], { a: "in_progress" }).map((t) => t.status)).toEqual([
      "in_progress",
      "done",
    ]);
  });
});
