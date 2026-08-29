import { describe, expect, it } from "vitest";
import {
  cloneTask,
  countTasks,
  createTask,
  deleteTask,
  findTaskById,
  insertTasks,
  listTasks,
  restoreTask,
  updateTask,
} from "@/entities/task/repository";
import { createList, findListById } from "@/entities/list/repository";
import { getDb } from "@/shared/lib/db";
import type { Task } from "@/entities/task/schema";

describe("countTasks", () => {
  it("counts every task in the store", () => {
    expect(countTasks()).toBe(Object.keys(getDb().tasks).length);
  });
});

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "insert-t1",
    listId: "insert-l1",
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

describe("createTask", () => {
  it("generates a TEST-N code scoped to the given list", () => {
    const listId = `create-l-${crypto.randomUUID()}`;
    const first = createTask({
      listId,
      title: "First",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    const second = createTask({
      listId,
      title: "Second",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    expect(first.code).toBe("TEST-1");
    expect(second.code).toBe("TEST-2");
  });

  it("sets server-owned defaults on the created task", () => {
    const listId = `create-l-${crypto.randomUUID()}`;
    const task = createTask({
      listId,
      title: "Task",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    expect(task.status).toBe("new");
    expect(task.dependsOn).toEqual([]);
    expect(task.subtaskIds).toEqual([]);
    expect(task.timeSpentMin).toBe(0);
    expect(task.timerStartedAt).toBeNull();
    expect(task.timerPausedAt).toBeNull();
    expect(task.extensions).toEqual([]);
    expect(task.history).toEqual([]);
    expect(task.deletedAt).toBeNull();
  });

  it("persists the created task in the repository", () => {
    const listId = `create-l-${crypto.randomUUID()}`;
    const task = createTask({
      listId,
      title: "Task",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    expect(findTaskById(task.id)).toEqual(task);
  });
});

describe("insertTasks", () => {
  it("stores each given task so it can be found by id", () => {
    const task = makeTask({ id: "insert-t2" });

    insertTasks([task]);

    expect(findTaskById("insert-t2")).toEqual(task);
  });

  it("makes inserted tasks discoverable by listId", () => {
    const task = makeTask({ id: "insert-t3", listId: "insert-l3" });

    insertTasks([task]);

    expect(listTasks("insert-l3")).toEqual([task]);
  });

  it("increases the total task count by the number of inserted tasks", () => {
    const before = countTasks();

    insertTasks([makeTask({ id: "insert-t4" }), makeTask({ id: "insert-t5" })]);

    expect(countTasks()).toBe(before + 2);
  });

  it("does nothing for an empty array", () => {
    const before = countTasks();

    insertTasks([]);

    expect(countTasks()).toBe(before);
  });
});

describe("updateTask", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("returns not_found for an unknown task id", () => {
    expect(updateTask("does-not-exist", "u1", { title: "New" }, NOW)).toEqual({ status: "not_found" });
  });

  it("returns not_found for a soft-deleted task", () => {
    const task = makeTask({ id: "upd-deleted", deletedAt: "2026-08-01T00:00:00.000Z" });
    insertTasks([task]);

    expect(updateTask(task.id, "u1", { title: "New" }, NOW)).toEqual({ status: "not_found" });
  });

  it("applies a single-field patch and persists it", () => {
    const task = makeTask({ id: "upd-title", title: "Old" });
    insertTasks([task]);

    const result = updateTask(task.id, "u1", { title: "New" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.title).toBe("New");
    }
    expect(findTaskById(task.id)!.title).toBe("New");
  });

  it("leaves fields not present in the patch untouched", () => {
    const task = makeTask({ id: "upd-partial", title: "Old", description: "keep me", priority: 2 });
    insertTasks([task]);

    updateTask(task.id, "u1", { title: "New" }, NOW);

    const stored = findTaskById(task.id)!;
    expect(stored.description).toBe("keep me");
    expect(stored.priority).toBe(2);
  });

  it("distinguishes an explicit null deadline from an untouched one", () => {
    const task = makeTask({ id: "upd-deadline", deadline: "2026-09-01T00:00:00.000Z" });
    insertTasks([task]);

    updateTask(task.id, "u1", { deadline: null }, NOW);

    expect(findTaskById(task.id)!.deadline).toBeNull();
  });

  it("records a history entry with old/new values, byUserId, and timestamp", () => {
    const task = makeTask({ id: "upd-history", priority: 2 });
    insertTasks([task]);

    updateTask(task.id, "u1", { priority: 4 }, NOW);

    expect(findTaskById(task.id)!.history).toEqual([
      { field: "priority", old: 2, new: 4, at: NOW.toISOString(), byUserId: "u1" },
    ]);
  });

  it("records one history entry per changed field", () => {
    const task = makeTask({ id: "upd-multi", title: "Old", priority: 2 });
    insertTasks([task]);

    updateTask(task.id, "u1", { title: "New", priority: 4 }, NOW);

    const history = findTaskById(task.id)!.history;
    expect(history.map((entry) => entry.field)).toEqual(["title", "priority"]);
  });

  it("does not add a history entry or change data for a no-op patch", () => {
    const task = makeTask({ id: "upd-noop", title: "Task" });
    insertTasks([task]);

    const result = updateTask(task.id, "u1", { title: "Task" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task).toEqual(task);
    }
    expect(findTaskById(task.id)!.history).toEqual([]);
  });

  it("rejects a self-referencing parentId without persisting", () => {
    const task = makeTask({ id: "upd-self-parent" });
    insertTasks([task]);

    const result = updateTask(task.id, "u1", { parentId: "upd-self-parent" }, NOW);

    expect(result).toEqual({ status: "invalid_parent" });
    expect(findTaskById(task.id)!.parentId).toBeNull();
  });

  it("rejects a parentId that does not reference an existing task", () => {
    const task = makeTask({ id: "upd-missing-parent" });
    insertTasks([task]);

    const result = updateTask(task.id, "u1", { parentId: "does-not-exist" }, NOW);

    expect(result).toEqual({ status: "invalid_parent" });
  });

  it("rejects a parentId that references a task in a different list", () => {
    const other = makeTask({ id: "upd-other-list", listId: "other-list" });
    const task = makeTask({ id: "upd-cross-list", listId: "this-list" });
    insertTasks([other, task]);

    const result = updateTask(task.id, "u1", { parentId: "upd-other-list" }, NOW);

    expect(result).toEqual({ status: "invalid_parent" });
  });

  it("accepts a parentId that references an existing task in the same list", () => {
    const parent = makeTask({ id: "upd-valid-parent", listId: "same-list" });
    const task = makeTask({ id: "upd-child", listId: "same-list" });
    insertTasks([parent, task]);

    const result = updateTask(task.id, "u1", { parentId: "upd-valid-parent" }, NOW);

    expect(result.status).toBe("ok");
    expect(findTaskById(task.id)!.parentId).toBe("upd-valid-parent");
  });

  it("rejects a parentId that would create a parent-hierarchy cycle", () => {
    const grandparent = makeTask({ id: "upd-cyc-gp", listId: "cyc-hier-list" });
    const parent = makeTask({ id: "upd-cyc-p", listId: "cyc-hier-list", parentId: "upd-cyc-gp" });
    insertTasks([grandparent, parent]);

    const result = updateTask(grandparent.id, "u1", { parentId: parent.id }, NOW);

    expect(result).toEqual({ status: "invalid_parent" });
    expect(findTaskById(grandparent.id)!.parentId).toBeNull();
  });

  it("adds the child id to the new parent's subtaskIds when parentId is assigned", () => {
    const parent = makeTask({ id: "upd-sync-parent", listId: "sync-list" });
    const child = makeTask({ id: "upd-sync-child", listId: "sync-list" });
    insertTasks([parent, child]);

    updateTask(child.id, "u1", { parentId: parent.id }, NOW);

    expect(findTaskById(parent.id)!.subtaskIds).toEqual([child.id]);
  });

  it("moves the child id from the old parent's subtaskIds to the new parent's when re-parenting", () => {
    const oldParent = makeTask({ id: "upd-sync-old", listId: "sync-list-2", subtaskIds: ["upd-sync-child-2"] });
    const newParent = makeTask({ id: "upd-sync-new", listId: "sync-list-2" });
    const child = makeTask({ id: "upd-sync-child-2", listId: "sync-list-2", parentId: "upd-sync-old" });
    insertTasks([oldParent, newParent, child]);

    updateTask(child.id, "u1", { parentId: newParent.id }, NOW);

    expect(findTaskById(oldParent.id)!.subtaskIds).toEqual([]);
    expect(findTaskById(newParent.id)!.subtaskIds).toEqual([child.id]);
  });

  it("removes the child id from the old parent's subtaskIds when parentId is cleared", () => {
    const parent = makeTask({ id: "upd-sync-clear-parent", listId: "sync-list-3", subtaskIds: ["upd-sync-clear-child"] });
    const child = makeTask({
      id: "upd-sync-clear-child",
      listId: "sync-list-3",
      parentId: "upd-sync-clear-parent",
    });
    insertTasks([parent, child]);

    const result = updateTask(child.id, "u1", { parentId: null }, NOW);

    expect(result.status).toBe("ok");
    expect(findTaskById(child.id)!.parentId).toBeNull();
    expect(findTaskById(parent.id)!.subtaskIds).toEqual([]);
  });

  it("does not duplicate the child id if it is already present in the new parent's subtaskIds", () => {
    const parent = makeTask({ id: "upd-sync-dup-parent", listId: "sync-list-4", subtaskIds: ["upd-sync-dup-child"] });
    const child = makeTask({ id: "upd-sync-dup-child", listId: "sync-list-4", parentId: null });
    insertTasks([parent, child]);

    updateTask(child.id, "u1", { parentId: parent.id }, NOW);

    expect(findTaskById(parent.id)!.subtaskIds).toEqual(["upd-sync-dup-child"]);
  });

  it("does not touch subtaskIds on other tasks when parentId is not part of the patch", () => {
    const parent = makeTask({ id: "upd-sync-untouched-parent", listId: "sync-list-5", subtaskIds: ["upd-sync-untouched-child"] });
    const child = makeTask({
      id: "upd-sync-untouched-child",
      listId: "sync-list-5",
      parentId: "upd-sync-untouched-parent",
    });
    insertTasks([parent, child]);

    updateTask(child.id, "u1", { title: "Renamed" }, NOW);

    expect(findTaskById(parent.id)!.subtaskIds).toEqual(["upd-sync-untouched-child"]);
  });

  it("rejects a dependsOn update that creates a self-cycle, without persisting", () => {
    const task = makeTask({ id: "upd-self-cycle" });
    insertTasks([task]);

    const result = updateTask(task.id, "u1", { dependsOn: ["upd-self-cycle"] }, NOW);

    expect(result).toEqual({ status: "cycle" });
    expect(findTaskById(task.id)!.dependsOn).toEqual([]);
  });

  it("rejects a dependsOn update that creates a regular cycle, without persisting", () => {
    const a = makeTask({ id: "upd-cyc-a", listId: "cyc-list", dependsOn: ["upd-cyc-b"] });
    const b = makeTask({ id: "upd-cyc-b", listId: "cyc-list" });
    insertTasks([a, b]);

    const result = updateTask(b.id, "u1", { dependsOn: ["upd-cyc-a"] }, NOW);

    expect(result).toEqual({ status: "cycle" });
    expect(findTaskById(b.id)!.dependsOn).toEqual([]);
  });

  it("accepts a valid dependsOn chain", () => {
    const a = makeTask({ id: "upd-chain-a", listId: "chain-list" });
    const b = makeTask({ id: "upd-chain-b", listId: "chain-list" });
    insertTasks([a, b]);

    const result = updateTask(b.id, "u1", { dependsOn: ["upd-chain-a"] }, NOW);

    expect(result.status).toBe("ok");
    expect(findTaskById(b.id)!.dependsOn).toEqual(["upd-chain-a"]);
  });

  it("does not compute cascade updates when status is unchanged", () => {
    const task = makeTask({ id: "upd-no-cascade", status: "new" });
    insertTasks([task]);

    const result = updateTask(task.id, "u1", { title: "New" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.cascade).toEqual([]);
    }
  });

  it("computes cascade updates for downstream dependents when status changes, via getCascadeUpdates", () => {
    const blocker = makeTask({ id: "upd-casc-blocker", listId: "casc-list", status: "new" });
    const dependent = makeTask({
      id: "upd-casc-dependent",
      listId: "casc-list",
      dependsOn: ["upd-casc-blocker"],
      status: "new",
    });
    const independent = makeTask({ id: "upd-casc-independent", listId: "casc-list", status: "new" });
    insertTasks([blocker, dependent, independent]);

    const result = updateTask(blocker.id, "u1", { status: "done" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const taskIds = result.cascade.map((update) => update.taskId);
      expect(taskIds).toContain("upd-casc-dependent");
      expect(taskIds).not.toContain("upd-casc-independent");

      const dependentUpdate = result.cascade.find((update) => update.taskId === "upd-casc-dependent")!;
      expect(dependentUpdate.isBlocked).toBe(false);
    }
  });

  it("resolves a multi-level cascade chain", () => {
    const a = makeTask({ id: "upd-chain2-a", listId: "chain2-list", status: "new" });
    const b = makeTask({ id: "upd-chain2-b", listId: "chain2-list", dependsOn: ["upd-chain2-a"], status: "new" });
    const c = makeTask({ id: "upd-chain2-c", listId: "chain2-list", dependsOn: ["upd-chain2-b"], status: "new" });
    insertTasks([a, b, c]);

    const result = updateTask(a.id, "u1", { status: "done" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const taskIds = result.cascade.map((update) => update.taskId);
      expect(taskIds).toEqual(["upd-chain2-b", "upd-chain2-c"]);
    }
  });

  it("updates the source task itself correctly alongside the cascade", () => {
    const task = makeTask({ id: "upd-source", status: "new" });
    insertTasks([task]);

    const result = updateTask(task.id, "u1", { status: "done" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.status).toBe("done");
    }
  });
});

describe("deleteTask", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("returns not_found for an unknown task id", () => {
    expect(deleteTask("does-not-exist", "u1", NOW)).toEqual({ status: "not_found" });
  });

  it("sets deletedAt on the task", () => {
    const task = makeTask({ id: "del-basic", deletedAt: null });
    insertTasks([task]);

    const result = deleteTask(task.id, "u1", NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.deletedAt).toBe(NOW.toISOString());
    }
  });

  it("keeps the task in the store rather than removing it (soft delete)", () => {
    const task = makeTask({ id: "del-persists", deletedAt: null });
    insertTasks([task]);

    deleteTask(task.id, "u1", NOW);

    expect(findTaskById(task.id)).toBeDefined();
    expect(countTasks()).toBeGreaterThan(0);
  });

  it("does not lose other fields when soft-deleting", () => {
    const task = makeTask({ id: "del-fields", title: "Keep me", priority: 4 });
    insertTasks([task]);

    deleteTask(task.id, "u1", NOW);

    const stored = findTaskById(task.id)!;
    expect(stored.title).toBe("Keep me");
    expect(stored.priority).toBe(4);
  });

  it("records a history entry for the deletion", () => {
    const task = makeTask({ id: "del-history", deletedAt: null });
    insertTasks([task]);

    deleteTask(task.id, "u1", NOW);

    expect(findTaskById(task.id)!.history).toEqual([
      { field: "deletedAt", old: null, new: NOW.toISOString(), at: NOW.toISOString(), byUserId: "u1" },
    ]);
  });

  it("is idempotent: deleting an already-deleted task does not change deletedAt or add history", () => {
    const firstDeletedAt = "2026-08-01T00:00:00.000Z";
    const task = makeTask({
      id: "del-repeat",
      deletedAt: firstDeletedAt,
      history: [{ field: "deletedAt", old: null, new: firstDeletedAt, at: firstDeletedAt, byUserId: "u1" }],
    });
    insertTasks([task]);

    const result = deleteTask(task.id, "u2", NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.deletedAt).toBe(firstDeletedAt);
    }
    const stored = findTaskById(task.id)!;
    expect(stored.deletedAt).toBe(firstDeletedAt);
    expect(stored.history).toEqual([
      { field: "deletedAt", old: null, new: firstDeletedAt, at: firstDeletedAt, byUserId: "u1" },
    ]);
  });

  it("does not change other fields on a repeated delete", () => {
    const task = makeTask({ id: "del-repeat-fields", deletedAt: "2026-08-01T00:00:00.000Z", title: "Original" });
    insertTasks([task]);

    deleteTask(task.id, "u1", NOW);

    expect(findTaskById(task.id)!.title).toBe("Original");
  });

  it("removes a deleted child from its parent's subtaskIds", () => {
    const parent = makeTask({ id: "del-sync-parent", subtaskIds: ["del-sync-child"] });
    const child = makeTask({ id: "del-sync-child", parentId: "del-sync-parent" });
    insertTasks([parent, child]);

    deleteTask(child.id, "u1", NOW);

    expect(findTaskById(parent.id)!.subtaskIds).toEqual([]);
  });

  it("preserves the deleted child's own parentId so the link can be restored", () => {
    const parent = makeTask({ id: "del-sync-preserve-parent", subtaskIds: ["del-sync-preserve-child"] });
    const child = makeTask({ id: "del-sync-preserve-child", parentId: "del-sync-preserve-parent" });
    insertTasks([parent, child]);

    deleteTask(child.id, "u1", NOW);

    expect(findTaskById(child.id)!.parentId).toBe("del-sync-preserve-parent");
  });

  it("leaves a deleted parent's subtaskIds and its children's parentId untouched", () => {
    const parent = makeTask({ id: "del-sync-parent-del", subtaskIds: ["del-sync-parent-del-child"] });
    const child = makeTask({ id: "del-sync-parent-del-child", parentId: "del-sync-parent-del" });
    insertTasks([parent, child]);

    deleteTask(parent.id, "u1", NOW);

    expect(findTaskById(parent.id)!.subtaskIds).toEqual(["del-sync-parent-del-child"]);
    expect(findTaskById(child.id)!.parentId).toBe("del-sync-parent-del");
  });
});

describe("cloneTask", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("returns not_found for an unknown task id", () => {
    expect(cloneTask("does-not-exist", NOW)).toEqual({ status: "not_found" });
  });

  it("returns deleted for a soft-deleted source task", () => {
    const task = makeTask({ id: "clone-deleted", deletedAt: "2026-08-01T00:00:00.000Z" });
    insertTasks([task]);

    expect(cloneTask(task.id, NOW)).toEqual({ status: "deleted" });
  });

  it("does not persist anything for a soft-deleted source task", () => {
    const task = makeTask({ id: "clone-deleted-noop" });
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);
    const before = countTasks();

    cloneTask(task.id, NOW);

    expect(countTasks()).toBe(before);
  });

  it("creates a new task with a different id", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = createTask({
      listId: list.id,
      title: "Source",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const result = cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.id).not.toBe(source.id);
    }
  });

  it("does not mutate the source task", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = createTask({
      listId: list.id,
      title: "Source",
      description: "desc",
      priority: 3,
      category: "work",
      tags: ["a"],
      parentId: null,
      deadline: null,
      estimatedMin: 30,
    });
    const snapshot = { ...findTaskById(source.id)! };

    cloneTask(source.id, NOW);

    expect(findTaskById(source.id)).toEqual(snapshot);
  });

  it("copies title, description, priority, category, tags, status, deadline, and estimatedMin", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = createTask({
      listId: list.id,
      title: "Source title",
      description: "Source description",
      priority: 4,
      category: "work",
      tags: ["urgent", "billing"],
      parentId: null,
      deadline: "2026-09-01T00:00:00.000Z",
      estimatedMin: 120,
    });

    const result = cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.title).toBe("Source title");
      expect(result.task.description).toBe("Source description");
      expect(result.task.priority).toBe(4);
      expect(result.task.category).toBe("work");
      expect(result.task.tags).toEqual(["urgent", "billing"]);
      expect(result.task.status).toBe("new");
      expect(result.task.deadline).toBe("2026-09-01T00:00:00.000Z");
      expect(result.task.estimatedMin).toBe(120);
    }
  });

  it("keeps the clone in the same list as the source", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = createTask({
      listId: list.id,
      title: "Source",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const result = cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.listId).toBe(list.id);
    }
  });

  it("adds the clone id to the list's taskIds", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = createTask({
      listId: list.id,
      title: "Source",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const result = cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(findListById(list.id)!.taskIds).toContain(result.task.id);
    }
  });

  it("assigns a new code that does not collide with the source's code", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = createTask({
      listId: list.id,
      title: "Source",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const result = cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.code).not.toBe(source.code);
    }
  });

  it("resets runtime timer state on the clone", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = createTask({
      listId: list.id,
      title: "Source",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    insertTasks([
      {
        ...findTaskById(source.id)!,
        timeSpentMin: 90,
        timerStartedAt: "2026-08-27T10:00:00.000Z",
        timerPausedAt: "2026-08-27T11:00:00.000Z",
        extensions: [{ commentId: "c1", addedMin: 30 }],
      },
    ]);

    const result = cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(0);
      expect(result.task.timerStartedAt).toBeNull();
      expect(result.task.timerPausedAt).toBeNull();
      expect(result.task.extensions).toEqual([]);
    }
  });

  it("resets history to an empty array on the clone", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = createTask({
      listId: list.id,
      title: "Source",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    updateTask(source.id, "u1", { title: "Renamed" }, NOW);

    const result = cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.history).toEqual([]);
    }
  });

  it("sets a fresh createdAt and a null deletedAt on the clone", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = createTask({
      listId: list.id,
      title: "Source",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const result = cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.createdAt).toBe(NOW.toISOString());
      expect(result.task.deletedAt).toBeNull();
    }
  });

  it("drops dependsOn references since the referenced tasks are not part of the clone", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const blocker = createTask({
      listId: list.id,
      title: "Blocker",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    const source = createTask({
      listId: list.id,
      title: "Source",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    insertTasks([{ ...findTaskById(source.id)!, dependsOn: [blocker.id] }]);

    const result = cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.dependsOn).toEqual([]);
    }
  });

  it("drops parentId and subtaskIds references not part of the clone", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const parent = createTask({
      listId: list.id,
      title: "Parent",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    const child = createTask({
      listId: list.id,
      title: "Child",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    const source = createTask({
      listId: list.id,
      title: "Source",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    insertTasks([{ ...findTaskById(source.id)!, parentId: parent.id, subtaskIds: [child.id] }]);

    const result = cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.parentId).toBeNull();
      expect(result.task.subtaskIds).toEqual([]);
    }
  });

  it("persists the clone so it can be found by id", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = createTask({
      listId: list.id,
      title: "Source",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const result = cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(findTaskById(result.task.id)).toEqual(result.task);
    }
  });

  it("creates a separate new task with a different id on a repeated clone", () => {
    const list = createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = createTask({
      listId: list.id,
      title: "Source",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const first = cloneTask(source.id, NOW);
    const second = cloneTask(source.id, NOW);

    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");
    if (first.status === "ok" && second.status === "ok") {
      expect(first.task.id).not.toBe(second.task.id);
      expect(first.task.code).not.toBe(second.task.code);
    }
  });
});

describe("restoreTask", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("returns not_found for an unknown task id", () => {
    expect(restoreTask("does-not-exist", "u1", NOW)).toEqual({ status: "not_found" });
  });

  it("clears deletedAt when restored within the 30-day window", () => {
    const task = makeTask({ id: "res-basic", deletedAt: "2026-08-01T00:00:00.000Z" });
    insertTasks([task]);

    const result = restoreTask(task.id, "u1", NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.deletedAt).toBeNull();
    }
    expect(findTaskById(task.id)!.deletedAt).toBeNull();
  });

  it("returns expired and leaves the task deleted when the restore window has passed", () => {
    const deletedAt = "2026-01-01T00:00:00.000Z";
    const task = makeTask({ id: "res-expired", deletedAt });
    insertTasks([task]);

    const result = restoreTask(task.id, "u1", NOW);

    expect(result).toEqual({ status: "expired" });
    expect(findTaskById(task.id)!.deletedAt).toBe(deletedAt);
  });

  it("is idempotent: restoring a task that is not deleted returns ok without changing history", () => {
    const task = makeTask({ id: "res-already", deletedAt: null });
    insertTasks([task]);

    const result = restoreTask(task.id, "u1", NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task).toEqual(task);
    }
    expect(findTaskById(task.id)!.history).toEqual([]);
  });

  it("records a history entry describing deletedAt moving back to null", () => {
    const deletedAt = "2026-08-01T00:00:00.000Z";
    const task = makeTask({ id: "res-history", deletedAt });
    insertTasks([task]);

    restoreTask(task.id, "u1", NOW);

    expect(findTaskById(task.id)!.history).toEqual([
      { field: "deletedAt", old: deletedAt, new: null, at: NOW.toISOString(), byUserId: "u1" },
    ]);
  });

  it("does not add a history entry on an already-restored task", () => {
    const task = makeTask({ id: "res-noop-history", deletedAt: null });
    insertTasks([task]);

    restoreTask(task.id, "u1", NOW);

    expect(findTaskById(task.id)!.history).toEqual([]);
  });

  it("preserves dependsOn, parentId, and subtaskIds when restoring", () => {
    const task = makeTask({
      id: "res-refs",
      deletedAt: "2026-08-01T00:00:00.000Z",
      dependsOn: ["other-1"],
      parentId: "parent-1",
      subtaskIds: ["child-1", "child-2"],
    });
    insertTasks([task]);

    restoreTask(task.id, "u1", NOW);

    const stored = findTaskById(task.id)!;
    expect(stored.dependsOn).toEqual(["other-1"]);
    expect(stored.parentId).toBe("parent-1");
    expect(stored.subtaskIds).toEqual(["child-1", "child-2"]);
  });

  it("does not lose other fields when restoring", () => {
    const task = makeTask({
      id: "res-fields",
      deletedAt: "2026-08-01T00:00:00.000Z",
      title: "Keep me",
      priority: 4,
    });
    insertTasks([task]);

    restoreTask(task.id, "u1", NOW);

    const stored = findTaskById(task.id)!;
    expect(stored.title).toBe("Keep me");
    expect(stored.priority).toBe(4);
  });

  it("re-adds a restored child to its still-active parent's subtaskIds", () => {
    const parent = makeTask({ id: "res-sync-parent", subtaskIds: [] });
    const child = makeTask({
      id: "res-sync-child",
      parentId: "res-sync-parent",
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    insertTasks([parent, child]);

    restoreTask(child.id, "u1", NOW);

    expect(findTaskById(parent.id)!.subtaskIds).toEqual(["res-sync-child"]);
  });

  it("does not duplicate the child id if the parent's subtaskIds already contains it", () => {
    const parent = makeTask({ id: "res-sync-dup-parent", subtaskIds: ["res-sync-dup-child"] });
    const child = makeTask({
      id: "res-sync-dup-child",
      parentId: "res-sync-dup-parent",
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    insertTasks([parent, child]);

    restoreTask(child.id, "u1", NOW);

    expect(findTaskById(parent.id)!.subtaskIds).toEqual(["res-sync-dup-child"]);
  });

  it("does not re-add the child to a parent that is itself soft-deleted", () => {
    const parent = makeTask({
      id: "res-sync-deleted-parent",
      subtaskIds: [],
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    const child = makeTask({
      id: "res-sync-deleted-parent-child",
      parentId: "res-sync-deleted-parent",
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    insertTasks([parent, child]);

    restoreTask(child.id, "u1", NOW);

    expect(findTaskById(parent.id)!.deletedAt).not.toBeNull();
    expect(findTaskById(parent.id)!.subtaskIds).toEqual([]);
  });

  it("does not crash restoring a child whose parent no longer exists", () => {
    const child = makeTask({
      id: "res-sync-missing-parent-child",
      parentId: "does-not-exist",
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    insertTasks([child]);

    const result = restoreTask(child.id, "u1", NOW);

    expect(result.status).toBe("ok");
  });
});
