import { describe, expect, it } from "vitest";
import {
  applyTaskExtension,
  cloneTask,
  countTasks,
  createTask,
  deleteTask,
  findTaskById,
  insertTasks,
  listTasks,
  restoreTask,
  rollbackTask,
  updateTask,
} from "@/entities/task/repository";
import { createList, findListById } from "@/entities/list/repository";
import { updateUserSettings } from "@/entities/user/repository";
import { getDb } from "@/shared/lib/db";
import type { Task } from "@/entities/task/schema";

describe("countTasks", () => {
  it("counts every task in the store", async () => {
    expect(await countTasks()).toBe(Object.keys((await getDb()).tasks).length);
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
  it("generates a TEST-N code scoped to the given list", async () => {
    const listId = `create-l-${crypto.randomUUID()}`;
    const first = await createTask({
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
    const second = await createTask({
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

  it("does not reuse the code of a deleted task, avoiding a collision with a later code", async () => {
    const listId = `create-l-${crypto.randomUUID()}`;
    const makeInList = async () =>
      await createTask({
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

    const first = await makeInList();
    const second = await makeInList();
    const third = await makeInList();
    await deleteTask(second.id, "u1");

    const fourth = await makeInList();

    const codes = [first.code, second.code, third.code, fourth.code];
    expect(new Set(codes).size).toBe(codes.length);
    expect(fourth.code).not.toBe(third.code);
  });

  it("keeps generating unique codes across several consecutive creates after a delete", async () => {
    const listId = `create-l-${crypto.randomUUID()}`;
    const makeInList = async () =>
      await createTask({
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

    const first = await makeInList();
    const second = await makeInList();
    await deleteTask(second.id, "u1");

    const created = [await makeInList(), await makeInList(), await makeInList()];

    const codes = [first.code, second.code, ...created.map((task) => task.code)];
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("treats a soft-deleted task's code as still occupied", async () => {
    const listId = `create-l-${crypto.randomUUID()}`;
    const first = await createTask({
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
    await deleteTask(first.id, "u1");

    const second = await createTask({
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

    expect(second.code).not.toBe(first.code);
  });

  it("does not let codes from another list influence the next code", async () => {
    const listA = `create-l-${crypto.randomUUID()}`;
    const listB = `create-l-${crypto.randomUUID()}`;
    await createTask({
      listId: listA,
      title: "In A",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    await createTask({
      listId: listA,
      title: "In A too",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const firstInB = await createTask({
      listId: listB,
      title: "In B",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    expect(firstInB.code).toBe("TEST-1");
  });

  it("fills a gap left by a missing code instead of always appending", async () => {
    const listId = `create-l-${crypto.randomUUID()}`;
    await insertTasks([
      makeTask({ id: "gap-t1", listId, code: "TEST-1" }),
      makeTask({ id: "gap-t2", listId, code: "TEST-2" }),
      makeTask({ id: "gap-t4", listId, code: "TEST-4" }),
    ]);

    const created = await createTask({
      listId,
      title: "Fills gap",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    expect(created.code).toBe("TEST-3");
  });

  it("skips a gap number that is already taken and picks the next free one", async () => {
    const listId = `create-l-${crypto.randomUUID()}`;
    await insertTasks([
      makeTask({ id: "gap2-t1", listId, code: "TEST-1" }),
      makeTask({ id: "gap2-t2", listId, code: "TEST-2" }),
      makeTask({ id: "gap2-t3", listId, code: "TEST-3" }),
      makeTask({ id: "gap2-t5", listId, code: "TEST-5" }),
    ]);

    const created = await createTask({
      listId,
      title: "Fills next gap",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    expect(created.code).toBe("TEST-4");
  });

  it("ignores a malformed existing code instead of crashing", async () => {
    const listId = `create-l-${crypto.randomUUID()}`;
    await insertTasks([makeTask({ id: "malformed-t1", listId, code: "TEST-x" })]);

    const created = await createTask({
      listId,
      title: "After malformed",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    expect(created.code).toBe("TEST-1");
  });

  it("sets server-owned defaults on the created task", async () => {
    const listId = `create-l-${crypto.randomUUID()}`;
    const task = await createTask({
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

  it("persists the created task in the repository", async () => {
    const listId = `create-l-${crypto.randomUUID()}`;
    const task = await createTask({
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

    expect(await findTaskById(task.id)).toEqual(task);
  });

  it("falls back to the creating user's settings.taskDefaults when priority/category/estimatedMin are omitted", async () => {
    await updateUserSettings("u1", { taskDefaults: { priority: 5, category: "Backend", estimatedMin: 45 } });
    const listId = `create-l-${crypto.randomUUID()}`;

    const task = await createTask({ listId, title: "Task", description: "", tags: [], parentId: null, deadline: null }, "u1");

    expect(task.priority).toBe(5);
    expect(task.category).toBe("Backend");
    expect(task.estimatedMin).toBe(45);
  });

  it("respects an explicitly provided value even when it equals the built-in default", async () => {
    await updateUserSettings("u1", { taskDefaults: { priority: 5, category: "Backend", estimatedMin: 45 } });
    const listId = `create-l-${crypto.randomUUID()}`;

    const task = await createTask(
      { listId, title: "Task", description: "", tags: [], parentId: null, deadline: null, priority: 2, category: null, estimatedMin: 0 },
      "u1",
    );

    expect(task.priority).toBe(2);
    expect(task.category).toBeNull();
    expect(task.estimatedMin).toBe(0);
  });

  it("does not leak one user's taskDefaults into another user's created task", async () => {
    await updateUserSettings("u1", { taskDefaults: { priority: 5, category: "Backend", estimatedMin: 45 } });
    await updateUserSettings("u2", { taskDefaults: { priority: 1, category: "Design", estimatedMin: 20 } });
    const listId = `create-l-${crypto.randomUUID()}`;

    const task = await createTask({ listId, title: "Task", description: "", tags: [], parentId: null, deadline: null }, "u2");

    expect(task.priority).toBe(1);
    expect(task.category).toBe("Design");
    expect(task.estimatedMin).toBe(20);
  });

  it("falls back to the built-in defaults when no creating user is provided", async () => {
    const listId = `create-l-${crypto.randomUUID()}`;

    const task = await createTask({ listId, title: "Task", description: "", tags: [], parentId: null, deadline: null });

    expect(task.priority).toBe(3);
    expect(task.category).toBeNull();
    expect(task.estimatedMin).toBe(60);
  });
});

describe("insertTasks", () => {
  it("stores each given task so it can be found by id", async () => {
    const task = makeTask({ id: "insert-t2" });

    await insertTasks([task]);

    expect(await findTaskById("insert-t2")).toEqual(task);
  });

  it("makes inserted tasks discoverable by listId", async () => {
    const task = makeTask({ id: "insert-t3", listId: "insert-l3" });

    await insertTasks([task]);

    expect(await listTasks("insert-l3")).toEqual([task]);
  });

  it("increases the total task count by the number of inserted tasks", async () => {
    const before = await countTasks();

    await insertTasks([makeTask({ id: "insert-t4" }), makeTask({ id: "insert-t5" })]);

    expect(await countTasks()).toBe(before + 2);
  });

  it("does nothing for an empty array", async () => {
    const before = await countTasks();

    await insertTasks([]);

    expect(await countTasks()).toBe(before);
  });
});

describe("updateTask", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("returns not_found for an unknown task id", async () => {
    expect(await updateTask("does-not-exist", "u1", { title: "New" }, NOW)).toEqual({ status: "not_found" });
  });

  it("returns not_found for a soft-deleted task", async () => {
    const task = makeTask({ id: "upd-deleted", deletedAt: "2026-08-01T00:00:00.000Z" });
    await insertTasks([task]);

    expect(await updateTask(task.id, "u1", { title: "New" }, NOW)).toEqual({ status: "not_found" });
  });

  it("applies a single-field patch and persists it", async () => {
    const task = makeTask({ id: "upd-title", title: "Old" });
    await insertTasks([task]);

    const result = await updateTask(task.id, "u1", { title: "New" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.title).toBe("New");
    }
    expect((await findTaskById(task.id))!.title).toBe("New");
  });

  it("leaves fields not present in the patch untouched", async () => {
    const task = makeTask({ id: "upd-partial", title: "Old", description: "keep me", priority: 2 });
    await insertTasks([task]);

    await updateTask(task.id, "u1", { title: "New" }, NOW);

    const stored = (await findTaskById(task.id))!;
    expect(stored.description).toBe("keep me");
    expect(stored.priority).toBe(2);
  });

  it("distinguishes an explicit null deadline from an untouched one", async () => {
    const task = makeTask({ id: "upd-deadline", deadline: "2026-09-01T00:00:00.000Z" });
    await insertTasks([task]);

    await updateTask(task.id, "u1", { deadline: null }, NOW);

    expect((await findTaskById(task.id))!.deadline).toBeNull();
  });

  it("records a history entry with old/new values, byUserId, and timestamp", async () => {
    const task = makeTask({ id: "upd-history", priority: 2 });
    await insertTasks([task]);

    await updateTask(task.id, "u1", { priority: 4 }, NOW);

    expect((await findTaskById(task.id))!.history).toEqual([
      { field: "priority", old: 2, new: 4, at: NOW.toISOString(), byUserId: "u1" },
    ]);
  });

  it("records one history entry per changed field", async () => {
    const task = makeTask({ id: "upd-multi", title: "Old", priority: 2 });
    await insertTasks([task]);

    await updateTask(task.id, "u1", { title: "New", priority: 4 }, NOW);

    const history = (await findTaskById(task.id))!.history;
    expect(history.map((entry) => entry.field)).toEqual(["title", "priority"]);
  });

  it("does not add a history entry or change data for a no-op patch", async () => {
    const task = makeTask({ id: "upd-noop", title: "Task" });
    await insertTasks([task]);

    const result = await updateTask(task.id, "u1", { title: "Task" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task).toEqual(task);
    }
    expect((await findTaskById(task.id))!.history).toEqual([]);
  });

  it("rejects a self-referencing parentId without persisting", async () => {
    const task = makeTask({ id: "upd-self-parent" });
    await insertTasks([task]);

    const result = await updateTask(task.id, "u1", { parentId: "upd-self-parent" }, NOW);

    expect(result).toEqual({ status: "invalid_parent" });
    expect((await findTaskById(task.id))!.parentId).toBeNull();
  });

  it("rejects a parentId that does not reference an existing task", async () => {
    const task = makeTask({ id: "upd-missing-parent" });
    await insertTasks([task]);

    const result = await updateTask(task.id, "u1", { parentId: "does-not-exist" }, NOW);

    expect(result).toEqual({ status: "invalid_parent" });
  });

  it("rejects a parentId that references a task in a different list", async () => {
    const other = makeTask({ id: "upd-other-list", listId: "other-list" });
    const task = makeTask({ id: "upd-cross-list", listId: "this-list" });
    await insertTasks([other, task]);

    const result = await updateTask(task.id, "u1", { parentId: "upd-other-list" }, NOW);

    expect(result).toEqual({ status: "invalid_parent" });
  });

  it("accepts a parentId that references an existing task in the same list", async () => {
    const parent = makeTask({ id: "upd-valid-parent", listId: "same-list" });
    const task = makeTask({ id: "upd-child", listId: "same-list" });
    await insertTasks([parent, task]);

    const result = await updateTask(task.id, "u1", { parentId: "upd-valid-parent" }, NOW);

    expect(result.status).toBe("ok");
    expect((await findTaskById(task.id))!.parentId).toBe("upd-valid-parent");
  });

  it("rejects a parentId that would create a parent-hierarchy cycle", async () => {
    const grandparent = makeTask({ id: "upd-cyc-gp", listId: "cyc-hier-list" });
    const parent = makeTask({ id: "upd-cyc-p", listId: "cyc-hier-list", parentId: "upd-cyc-gp" });
    await insertTasks([grandparent, parent]);

    const result = await updateTask(grandparent.id, "u1", { parentId: parent.id }, NOW);

    expect(result).toEqual({ status: "invalid_parent" });
    expect((await findTaskById(grandparent.id))!.parentId).toBeNull();
  });

  it("adds the child id to the new parent's subtaskIds when parentId is assigned", async () => {
    const parent = makeTask({ id: "upd-sync-parent", listId: "sync-list" });
    const child = makeTask({ id: "upd-sync-child", listId: "sync-list" });
    await insertTasks([parent, child]);

    await updateTask(child.id, "u1", { parentId: parent.id }, NOW);

    expect((await findTaskById(parent.id))!.subtaskIds).toEqual([child.id]);
  });

  it("moves the child id from the old parent's subtaskIds to the new parent's when re-parenting", async () => {
    const oldParent = makeTask({ id: "upd-sync-old", listId: "sync-list-2", subtaskIds: ["upd-sync-child-2"] });
    const newParent = makeTask({ id: "upd-sync-new", listId: "sync-list-2" });
    const child = makeTask({ id: "upd-sync-child-2", listId: "sync-list-2", parentId: "upd-sync-old" });
    await insertTasks([oldParent, newParent, child]);

    await updateTask(child.id, "u1", { parentId: newParent.id }, NOW);

    expect((await findTaskById(oldParent.id))!.subtaskIds).toEqual([]);
    expect((await findTaskById(newParent.id))!.subtaskIds).toEqual([child.id]);
  });

  it("removes the child id from the old parent's subtaskIds when parentId is cleared", async () => {
    const parent = makeTask({ id: "upd-sync-clear-parent", listId: "sync-list-3", subtaskIds: ["upd-sync-clear-child"] });
    const child = makeTask({
      id: "upd-sync-clear-child",
      listId: "sync-list-3",
      parentId: "upd-sync-clear-parent",
    });
    await insertTasks([parent, child]);

    const result = await updateTask(child.id, "u1", { parentId: null }, NOW);

    expect(result.status).toBe("ok");
    expect((await findTaskById(child.id))!.parentId).toBeNull();
    expect((await findTaskById(parent.id))!.subtaskIds).toEqual([]);
  });

  it("does not duplicate the child id if it is already present in the new parent's subtaskIds", async () => {
    const parent = makeTask({ id: "upd-sync-dup-parent", listId: "sync-list-4", subtaskIds: ["upd-sync-dup-child"] });
    const child = makeTask({ id: "upd-sync-dup-child", listId: "sync-list-4", parentId: null });
    await insertTasks([parent, child]);

    await updateTask(child.id, "u1", { parentId: parent.id }, NOW);

    expect((await findTaskById(parent.id))!.subtaskIds).toEqual(["upd-sync-dup-child"]);
  });

  it("does not touch subtaskIds on other tasks when parentId is not part of the patch", async () => {
    const parent = makeTask({ id: "upd-sync-untouched-parent", listId: "sync-list-5", subtaskIds: ["upd-sync-untouched-child"] });
    const child = makeTask({
      id: "upd-sync-untouched-child",
      listId: "sync-list-5",
      parentId: "upd-sync-untouched-parent",
    });
    await insertTasks([parent, child]);

    await updateTask(child.id, "u1", { title: "Renamed" }, NOW);

    expect((await findTaskById(parent.id))!.subtaskIds).toEqual(["upd-sync-untouched-child"]);
  });

  it("rejects a dependsOn update that creates a self-cycle, without persisting", async () => {
    const task = makeTask({ id: "upd-self-cycle" });
    await insertTasks([task]);

    const result = await updateTask(task.id, "u1", { dependsOn: ["upd-self-cycle"] }, NOW);

    expect(result).toEqual({ status: "invalid_dependsOn" });
    expect((await findTaskById(task.id))!.dependsOn).toEqual([]);
  });

  it("rejects a dependsOn id from another list, without persisting", async () => {
    const foreign = makeTask({ id: "upd-dep-foreign", listId: "other-list" });
    const task = makeTask({ id: "upd-dep-local", listId: "this-list" });
    await insertTasks([foreign, task]);

    const result = await updateTask(task.id, "u1", { dependsOn: ["upd-dep-foreign"] }, NOW);

    expect(result).toEqual({ status: "invalid_dependsOn" });
    expect((await findTaskById(task.id))!.dependsOn).toEqual([]);
  });

  it("rejects a deleted dependsOn target, without persisting", async () => {
    const blocker = makeTask({
      id: "upd-dep-deleted",
      listId: "dep-list",
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    const task = makeTask({ id: "upd-dep-live", listId: "dep-list" });
    await insertTasks([blocker, task]);

    const result = await updateTask(task.id, "u1", { dependsOn: ["upd-dep-deleted"] }, NOW);

    expect(result).toEqual({ status: "invalid_dependsOn" });
    expect((await findTaskById(task.id))!.dependsOn).toEqual([]);
  });

  it("rejects an unknown dependsOn id, without persisting", async () => {
    const task = makeTask({ id: "upd-dep-unknown", listId: "dep-list" });
    await insertTasks([task]);

    const result = await updateTask(task.id, "u1", { dependsOn: ["does-not-exist"] }, NOW);

    expect(result).toEqual({ status: "invalid_dependsOn" });
    expect((await findTaskById(task.id))!.dependsOn).toEqual([]);
  });

  it("rejects a dependsOn update that creates a regular cycle, without persisting", async () => {
    const a = makeTask({ id: "upd-cyc-a", listId: "cyc-list", dependsOn: ["upd-cyc-b"] });
    const b = makeTask({ id: "upd-cyc-b", listId: "cyc-list" });
    await insertTasks([a, b]);

    const result = await updateTask(b.id, "u1", { dependsOn: ["upd-cyc-a"] }, NOW);

    expect(result).toEqual({ status: "cycle" });
    expect((await findTaskById(b.id))!.dependsOn).toEqual([]);
  });

  it("accepts a valid dependsOn chain", async () => {
    const a = makeTask({ id: "upd-chain-a", listId: "chain-list" });
    const b = makeTask({ id: "upd-chain-b", listId: "chain-list" });
    await insertTasks([a, b]);

    const result = await updateTask(b.id, "u1", { dependsOn: ["upd-chain-a"] }, NOW);

    expect(result.status).toBe("ok");
    expect((await findTaskById(b.id))!.dependsOn).toEqual(["upd-chain-a"]);
  });

  it("does not compute cascade updates when status is unchanged", async () => {
    const task = makeTask({ id: "upd-no-cascade", status: "new" });
    await insertTasks([task]);

    const result = await updateTask(task.id, "u1", { title: "New" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.cascade).toEqual([]);
    }
  });

  it("computes cascade updates for downstream dependents when status changes, via getCascadeUpdates", async () => {
    const blocker = makeTask({ id: "upd-casc-blocker", listId: "casc-list", status: "new" });
    const dependent = makeTask({
      id: "upd-casc-dependent",
      listId: "casc-list",
      dependsOn: ["upd-casc-blocker"],
      status: "new",
    });
    const independent = makeTask({ id: "upd-casc-independent", listId: "casc-list", status: "new" });
    await insertTasks([blocker, dependent, independent]);

    const result = await updateTask(blocker.id, "u1", { status: "done" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const taskIds = result.cascade.map((update) => update.taskId);
      expect(taskIds).toContain("upd-casc-dependent");
      expect(taskIds).not.toContain("upd-casc-independent");

      const dependentUpdate = result.cascade.find((update) => update.taskId === "upd-casc-dependent")!;
      expect(dependentUpdate.isBlocked).toBe(false);
    }
  });

  it("does not persist the cascade's recalculatedPriority/isBlocked back onto the downstream task", async () => {
    // getCascadeUpdates is deliberately pure derived state (see
    // widgets/task/task-detail.tsx's "cascade is informational only"
    // comment): Task.priority stays the user-set base value, and isBlocked
    // has no column on Task at all — both are recomputed live everywhere
    // they're displayed (Kanban, task detail, dashboard sorting), so
    // persisting either here would let a Smart Priority boost get baked in
    // and compound on every future recalculation.
    const blocker = makeTask({ id: "upd-casc-persist-blocker", listId: "casc-persist-list", status: "new" });
    const dependent = makeTask({
      id: "upd-casc-persist-dependent",
      listId: "casc-persist-list",
      dependsOn: ["upd-casc-persist-blocker"],
      status: "new",
      priority: 2,
      deadline: "2026-08-01T00:00:00.000Z", // overdue relative to NOW, so calculatePriority applies a real boost
    });
    await insertTasks([blocker, dependent]);

    const result = await updateTask(blocker.id, "u1", { status: "done" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const dependentUpdate = result.cascade.find((update) => update.taskId === dependent.id)!;
      expect(dependentUpdate.recalculatedPriority).not.toBe(2);
    }
    expect((await findTaskById(dependent.id))!.priority).toBe(2);
  });

  it("resolves a multi-level cascade chain", async () => {
    const a = makeTask({ id: "upd-chain2-a", listId: "chain2-list", status: "new" });
    const b = makeTask({ id: "upd-chain2-b", listId: "chain2-list", dependsOn: ["upd-chain2-a"], status: "new" });
    const c = makeTask({ id: "upd-chain2-c", listId: "chain2-list", dependsOn: ["upd-chain2-b"], status: "new" });
    await insertTasks([a, b, c]);

    const result = await updateTask(a.id, "u1", { status: "done" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const taskIds = result.cascade.map((update) => update.taskId);
      expect(taskIds).toEqual(["upd-chain2-b", "upd-chain2-c"]);
    }
  });

  it("rejects completing a task blocked by an incomplete dependency, without persisting", async () => {
    const blocker = makeTask({ id: "upd-block-blocker", listId: "block-list", status: "new" });
    const blocked = makeTask({
      id: "upd-block-target",
      listId: "block-list",
      dependsOn: ["upd-block-blocker"],
      status: "in_progress",
    });
    await insertTasks([blocker, blocked]);

    const result = await updateTask(blocked.id, "u1", { status: "done" }, NOW);

    expect(result).toEqual({ status: "blocked" });
    expect((await findTaskById(blocked.id))!.status).toBe("in_progress");
  });

  it("allows completing a task once its blocker is done", async () => {
    const blocker = makeTask({ id: "upd-unblock-blocker", listId: "unblock-list", status: "done" });
    const target = makeTask({
      id: "upd-unblock-target",
      listId: "unblock-list",
      dependsOn: ["upd-unblock-blocker"],
      status: "in_progress",
    });
    await insertTasks([blocker, target]);

    const result = await updateTask(target.id, "u1", { status: "done" }, NOW);

    expect(result.status).toBe("ok");
    expect((await findTaskById(target.id))!.status).toBe("done");
  });

  it("rejects completing a task with multiple blockers when only one is incomplete", async () => {
    const doneBlocker = makeTask({ id: "upd-multi-done", listId: "multi-list", status: "done" });
    const openBlocker = makeTask({ id: "upd-multi-open", listId: "multi-list", status: "new" });
    const target = makeTask({
      id: "upd-multi-target",
      listId: "multi-list",
      dependsOn: ["upd-multi-done", "upd-multi-open"],
      status: "in_progress",
    });
    await insertTasks([doneBlocker, openBlocker, target]);

    const result = await updateTask(target.id, "u1", { status: "done" }, NOW);

    expect(result).toEqual({ status: "blocked" });
    expect((await findTaskById(target.id))!.status).toBe("in_progress");
  });

  it("allows completing a task whose only blocker was deleted", async () => {
    const deletedBlocker = makeTask({
      id: "upd-deleted-blocker",
      listId: "deleted-blocker-list",
      status: "new",
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    const target = makeTask({
      id: "upd-deleted-blocker-target",
      listId: "deleted-blocker-list",
      dependsOn: ["upd-deleted-blocker"],
      status: "in_progress",
    });
    await insertTasks([deletedBlocker, target]);

    const result = await updateTask(target.id, "u1", { status: "done" }, NOW);

    expect(result.status).toBe("ok");
    expect((await findTaskById(target.id))!.status).toBe("done");
  });

  it("allows completing a task with no dependencies", async () => {
    const task = makeTask({ id: "upd-no-dep-target", listId: "no-dep-list", status: "in_progress" });
    await insertTasks([task]);

    const result = await updateTask(task.id, "u1", { status: "done" }, NOW);

    expect(result.status).toBe("ok");
    expect((await findTaskById(task.id))!.status).toBe("done");
  });

  it("allows other status transitions on a blocked task (only completion is restricted)", async () => {
    const blocker = makeTask({ id: "upd-block-move-blocker", listId: "block-move-list", status: "new" });
    const blocked = makeTask({
      id: "upd-block-move-target",
      listId: "block-move-list",
      dependsOn: ["upd-block-move-blocker"],
      status: "new",
    });
    await insertTasks([blocker, blocked]);

    const result = await updateTask(blocked.id, "u1", { status: "in_progress" }, NOW);

    expect(result.status).toBe("ok");
    expect((await findTaskById(blocked.id))!.status).toBe("in_progress");
  });

  it("updates the source task itself correctly alongside the cascade", async () => {
    const task = makeTask({ id: "upd-source", status: "new" });
    await insertTasks([task]);

    const result = await updateTask(task.id, "u1", { status: "done" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.status).toBe("done");
    }
  });

  it("computes cascade priority using real history from completed same-category tasks, not a stub", async () => {
    const blocker = makeTask({ id: "upd-hist-blocker", listId: "hist-list", status: "new" });
    const dependent = makeTask({
      id: "upd-hist-dependent",
      listId: "hist-list",
      dependsOn: ["upd-hist-blocker"],
      status: "new",
      priority: 2,
      category: "Backend",
      estimatedMin: 60,
    });
    const doneSimilar = makeTask({
      id: "upd-hist-done",
      listId: "hist-list",
      status: "done",
      category: "Backend",
      timeSpentMin: 90,
    });
    await insertTasks([blocker, dependent, doneSimilar]);

    const result = await updateTask(blocker.id, "u1", { status: "done" }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      const dependentUpdate = result.cascade.find((update) => update.taskId === dependent.id)!;
      expect(dependentUpdate.recalculatedPriority).toBe(5);
    }
  });
});

describe("applyTaskExtension", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("returns not_found for an unknown task id", async () => {
    expect(await applyTaskExtension("does-not-exist", "u1", { commentId: "c1", addedMin: 60 }, NOW)).toEqual({
      status: "not_found",
    });
  });

  it("returns not_found for a soft-deleted task", async () => {
    const task = makeTask({ id: "ext-deleted", deletedAt: "2026-08-01T00:00:00.000Z" });
    await insertTasks([task]);

    expect(await applyTaskExtension(task.id, "u1", { commentId: "c1", addedMin: 60 }, NOW)).toEqual({
      status: "not_found",
    });
  });

  it("adds the extension minutes to estimatedMin", async () => {
    const task = makeTask({ id: "ext-add", estimatedMin: 90 });
    await insertTasks([task]);

    const result = await applyTaskExtension(task.id, "u1", { commentId: "c1", addedMin: 60 }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.estimatedMin).toBe(150);
    }
    expect((await findTaskById(task.id))!.estimatedMin).toBe(150);
  });

  it("works when estimatedMin starts at 0", async () => {
    const task = makeTask({ id: "ext-zero", estimatedMin: 0 });
    await insertTasks([task]);

    const result = await applyTaskExtension(task.id, "u1", { commentId: "c1", addedMin: 30 }, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.estimatedMin).toBe(30);
    }
  });

  it("appends the extension record with commentId and addedMin", async () => {
    const task = makeTask({ id: "ext-record", estimatedMin: 0 });
    await insertTasks([task]);

    await applyTaskExtension(task.id, "u1", { commentId: "c1", addedMin: 60 }, NOW);

    expect((await findTaskById(task.id))!.extensions).toEqual([{ commentId: "c1", addedMin: 60 }]);
  });

  it("accumulates extensions from independent calls", async () => {
    const task = makeTask({ id: "ext-multi", estimatedMin: 0 });
    await insertTasks([task]);

    await applyTaskExtension(task.id, "u1", { commentId: "c1", addedMin: 60 }, NOW);
    await applyTaskExtension(task.id, "u1", { commentId: "c2", addedMin: 30 }, NOW);

    const stored = (await findTaskById(task.id))!;
    expect(stored.estimatedMin).toBe(90);
    expect(stored.extensions).toEqual([
      { commentId: "c1", addedMin: 60 },
      { commentId: "c2", addedMin: 30 },
    ]);
  });

  it("records an estimatedMin history entry with old/new values, byUserId, and timestamp", async () => {
    const task = makeTask({ id: "ext-history", estimatedMin: 10 });
    await insertTasks([task]);

    await applyTaskExtension(task.id, "u1", { commentId: "c1", addedMin: 60 }, NOW);

    expect((await findTaskById(task.id))!.history).toEqual([
      { field: "estimatedMin", old: 10, new: 70, at: NOW.toISOString(), byUserId: "u1" },
    ]);
  });
});

describe("deleteTask", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("returns not_found for an unknown task id", async () => {
    expect(await deleteTask("does-not-exist", "u1", NOW)).toEqual({ status: "not_found" });
  });

  it("sets deletedAt on the task", async () => {
    const task = makeTask({ id: "del-basic", deletedAt: null });
    await insertTasks([task]);

    const result = await deleteTask(task.id, "u1", NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.deletedAt).toBe(NOW.toISOString());
    }
  });

  it("keeps the task in the store rather than removing it (soft delete)", async () => {
    const task = makeTask({ id: "del-persists", deletedAt: null });
    await insertTasks([task]);

    await deleteTask(task.id, "u1", NOW);

    expect(await findTaskById(task.id)).toBeDefined();
    expect(await countTasks()).toBeGreaterThan(0);
  });

  it("does not lose other fields when soft-deleting", async () => {
    const task = makeTask({ id: "del-fields", title: "Keep me", priority: 4 });
    await insertTasks([task]);

    await deleteTask(task.id, "u1", NOW);

    const stored = (await findTaskById(task.id))!;
    expect(stored.title).toBe("Keep me");
    expect(stored.priority).toBe(4);
  });

  it("records a history entry for the deletion", async () => {
    const task = makeTask({ id: "del-history", deletedAt: null });
    await insertTasks([task]);

    await deleteTask(task.id, "u1", NOW);

    expect((await findTaskById(task.id))!.history).toEqual([
      { field: "deletedAt", old: null, new: NOW.toISOString(), at: NOW.toISOString(), byUserId: "u1" },
    ]);
  });

  it("is idempotent: deleting an already-deleted task does not change deletedAt or add history", async () => {
    const firstDeletedAt = "2026-08-01T00:00:00.000Z";
    const task = makeTask({
      id: "del-repeat",
      deletedAt: firstDeletedAt,
      history: [{ field: "deletedAt", old: null, new: firstDeletedAt, at: firstDeletedAt, byUserId: "u1" }],
    });
    await insertTasks([task]);

    const result = await deleteTask(task.id, "u2", NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.deletedAt).toBe(firstDeletedAt);
    }
    const stored = (await findTaskById(task.id))!;
    expect(stored.deletedAt).toBe(firstDeletedAt);
    expect(stored.history).toEqual([
      { field: "deletedAt", old: null, new: firstDeletedAt, at: firstDeletedAt, byUserId: "u1" },
    ]);
  });

  it("does not change other fields on a repeated delete", async () => {
    const task = makeTask({ id: "del-repeat-fields", deletedAt: "2026-08-01T00:00:00.000Z", title: "Original" });
    await insertTasks([task]);

    await deleteTask(task.id, "u1", NOW);

    expect((await findTaskById(task.id))!.title).toBe("Original");
  });

  it("removes a deleted child from its parent's subtaskIds", async () => {
    const parent = makeTask({ id: "del-sync-parent", subtaskIds: ["del-sync-child"] });
    const child = makeTask({ id: "del-sync-child", parentId: "del-sync-parent" });
    await insertTasks([parent, child]);

    await deleteTask(child.id, "u1", NOW);

    expect((await findTaskById(parent.id))!.subtaskIds).toEqual([]);
  });

  it("preserves the deleted child's own parentId so the link can be restored", async () => {
    const parent = makeTask({ id: "del-sync-preserve-parent", subtaskIds: ["del-sync-preserve-child"] });
    const child = makeTask({ id: "del-sync-preserve-child", parentId: "del-sync-preserve-parent" });
    await insertTasks([parent, child]);

    await deleteTask(child.id, "u1", NOW);

    expect((await findTaskById(child.id))!.parentId).toBe("del-sync-preserve-parent");
  });

  it("leaves a deleted parent's subtaskIds and its children's parentId untouched", async () => {
    const parent = makeTask({ id: "del-sync-parent-del", subtaskIds: ["del-sync-parent-del-child"] });
    const child = makeTask({ id: "del-sync-parent-del-child", parentId: "del-sync-parent-del" });
    await insertTasks([parent, child]);

    await deleteTask(parent.id, "u1", NOW);

    expect((await findTaskById(parent.id))!.subtaskIds).toEqual(["del-sync-parent-del-child"]);
    expect((await findTaskById(child.id))!.parentId).toBe("del-sync-parent-del");
  });
});

describe("cloneTask", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("returns not_found for an unknown task id", async () => {
    expect(await cloneTask("does-not-exist", NOW)).toEqual({ status: "not_found" });
  });

  it("returns deleted for a soft-deleted source task", async () => {
    const task = makeTask({ id: "clone-deleted", deletedAt: "2026-08-01T00:00:00.000Z" });
    await insertTasks([task]);

    expect(await cloneTask(task.id, NOW)).toEqual({ status: "deleted" });
  });

  it("does not persist anything for a soft-deleted source task", async () => {
    const task = makeTask({ id: "clone-deleted-noop" });
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);
    const before = await countTasks();

    await cloneTask(task.id, NOW);

    expect(await countTasks()).toBe(before);
  });

  it("creates a new task with a different id", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = await createTask({
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

    const result = await cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.id).not.toBe(source.id);
    }
  });

  it("does not mutate the source task", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = await createTask({
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
    const snapshot = { ...(await findTaskById(source.id))! };

    await cloneTask(source.id, NOW);

    expect(await findTaskById(source.id)).toEqual(snapshot);
  });

  it("copies title, description, priority, category, tags, status, deadline, and estimatedMin", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = await createTask({
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

    const result = await cloneTask(source.id, NOW);

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

  it("keeps the clone in the same list as the source", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = await createTask({
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

    const result = await cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.listId).toBe(list.id);
    }
  });

  it("adds the clone id to the list's taskIds", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = await createTask({
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

    const result = await cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect((await findListById(list.id))!.taskIds).toContain(result.task.id);
    }
  });

  it("assigns a new code that does not collide with the source's code", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = await createTask({
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

    const result = await cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.code).not.toBe(source.code);
    }
  });

  it("resets runtime timer state on the clone", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = await createTask({
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
    await insertTasks([
      {
        ...(await findTaskById(source.id))!,
        timeSpentMin: 90,
        timerStartedAt: "2026-08-27T10:00:00.000Z",
        timerPausedAt: "2026-08-27T11:00:00.000Z",
        extensions: [{ commentId: "c1", addedMin: 30 }],
      },
    ]);

    const result = await cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.timeSpentMin).toBe(0);
      expect(result.task.timerStartedAt).toBeNull();
      expect(result.task.timerPausedAt).toBeNull();
      expect(result.task.extensions).toEqual([]);
    }
  });

  it("resets history to an empty array on the clone", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = await createTask({
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
    await updateTask(source.id, "u1", { title: "Renamed" }, NOW);

    const result = await cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.history).toEqual([]);
    }
  });

  it("sets a fresh createdAt and a null deletedAt on the clone", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = await createTask({
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

    const result = await cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.createdAt).toBe(NOW.toISOString());
      expect(result.task.deletedAt).toBeNull();
    }
  });

  it("drops dependsOn references since the referenced tasks are not part of the clone", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const blocker = await createTask({
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
    const source = await createTask({
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
    await insertTasks([{ ...(await findTaskById(source.id))!, dependsOn: [blocker.id] }]);

    const result = await cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.dependsOn).toEqual([]);
    }
  });

  it("drops parentId and subtaskIds references not part of the clone", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const parent = await createTask({
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
    const child = await createTask({
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
    const source = await createTask({
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
    await insertTasks([{ ...(await findTaskById(source.id))!, parentId: parent.id, subtaskIds: [child.id] }]);

    const result = await cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.parentId).toBeNull();
      expect(result.task.subtaskIds).toEqual([]);
    }
  });

  it("persists the clone so it can be found by id", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = await createTask({
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

    const result = await cloneTask(source.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(await findTaskById(result.task.id)).toEqual(result.task);
    }
  });

  it("creates a separate new task with a different id on a repeated clone", async () => {
    const list = await createList("u1", { title: "Clone list", template: "work", deadline: null });
    const source = await createTask({
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

    const first = await cloneTask(source.id, NOW);
    const second = await cloneTask(source.id, NOW);

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

  it("returns not_found for an unknown task id", async () => {
    expect(await restoreTask("does-not-exist", "u1", NOW)).toEqual({ status: "not_found" });
  });

  it("clears deletedAt when restored within the 30-day window", async () => {
    const task = makeTask({ id: "res-basic", deletedAt: "2026-08-01T00:00:00.000Z" });
    await insertTasks([task]);

    const result = await restoreTask(task.id, "u1", NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.deletedAt).toBeNull();
    }
    expect((await findTaskById(task.id))!.deletedAt).toBeNull();
  });

  it("returns expired and leaves the task deleted when the restore window has passed", async () => {
    const deletedAt = "2026-01-01T00:00:00.000Z";
    const task = makeTask({ id: "res-expired", deletedAt });
    await insertTasks([task]);

    const result = await restoreTask(task.id, "u1", NOW);

    expect(result).toEqual({ status: "expired" });
    expect((await findTaskById(task.id))!.deletedAt).toBe(deletedAt);
  });

  it("is idempotent: restoring a task that is not deleted returns ok without changing history", async () => {
    const task = makeTask({ id: "res-already", deletedAt: null });
    await insertTasks([task]);

    const result = await restoreTask(task.id, "u1", NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task).toEqual(task);
    }
    expect((await findTaskById(task.id))!.history).toEqual([]);
  });

  it("records a history entry describing deletedAt moving back to null", async () => {
    const deletedAt = "2026-08-01T00:00:00.000Z";
    const task = makeTask({ id: "res-history", deletedAt });
    await insertTasks([task]);

    await restoreTask(task.id, "u1", NOW);

    expect((await findTaskById(task.id))!.history).toEqual([
      { field: "deletedAt", old: deletedAt, new: null, at: NOW.toISOString(), byUserId: "u1" },
    ]);
  });

  it("does not add a history entry on an already-restored task", async () => {
    const task = makeTask({ id: "res-noop-history", deletedAt: null });
    await insertTasks([task]);

    await restoreTask(task.id, "u1", NOW);

    expect((await findTaskById(task.id))!.history).toEqual([]);
  });

  it("preserves dependsOn, parentId, and subtaskIds when restoring", async () => {
    const task = makeTask({
      id: "res-refs",
      deletedAt: "2026-08-01T00:00:00.000Z",
      dependsOn: ["other-1"],
      parentId: "parent-1",
      subtaskIds: ["child-1", "child-2"],
    });
    await insertTasks([task]);

    await restoreTask(task.id, "u1", NOW);

    const stored = (await findTaskById(task.id))!;
    expect(stored.dependsOn).toEqual(["other-1"]);
    expect(stored.parentId).toBe("parent-1");
    expect(stored.subtaskIds).toEqual(["child-1", "child-2"]);
  });

  it("does not lose other fields when restoring", async () => {
    const task = makeTask({
      id: "res-fields",
      deletedAt: "2026-08-01T00:00:00.000Z",
      title: "Keep me",
      priority: 4,
    });
    await insertTasks([task]);

    await restoreTask(task.id, "u1", NOW);

    const stored = (await findTaskById(task.id))!;
    expect(stored.title).toBe("Keep me");
    expect(stored.priority).toBe(4);
  });

  it("re-adds a restored child to its still-active parent's subtaskIds", async () => {
    const parent = makeTask({ id: "res-sync-parent", subtaskIds: [] });
    const child = makeTask({
      id: "res-sync-child",
      parentId: "res-sync-parent",
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    await insertTasks([parent, child]);

    await restoreTask(child.id, "u1", NOW);

    expect((await findTaskById(parent.id))!.subtaskIds).toEqual(["res-sync-child"]);
  });

  it("does not duplicate the child id if the parent's subtaskIds already contains it", async () => {
    const parent = makeTask({ id: "res-sync-dup-parent", subtaskIds: ["res-sync-dup-child"] });
    const child = makeTask({
      id: "res-sync-dup-child",
      parentId: "res-sync-dup-parent",
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    await insertTasks([parent, child]);

    await restoreTask(child.id, "u1", NOW);

    expect((await findTaskById(parent.id))!.subtaskIds).toEqual(["res-sync-dup-child"]);
  });

  it("does not re-add the child to a parent that is itself soft-deleted", async () => {
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
    await insertTasks([parent, child]);

    await restoreTask(child.id, "u1", NOW);

    expect((await findTaskById(parent.id))!.deletedAt).not.toBeNull();
    expect((await findTaskById(parent.id))!.subtaskIds).toEqual([]);
  });

  it("does not crash restoring a child whose parent no longer exists", async () => {
    const child = makeTask({
      id: "res-sync-missing-parent-child",
      parentId: "does-not-exist",
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    await insertTasks([child]);

    const result = await restoreTask(child.id, "u1", NOW);

    expect(result.status).toBe("ok");
  });

  it("does not write a foreign-list parent's subtaskIds on restore (legacy cross-list parentId)", async () => {
    const parent = makeTask({ id: "res-idor-parent", listId: "list-b", subtaskIds: [] });
    const child = makeTask({
      id: "res-idor-child",
      listId: "list-a",
      parentId: "res-idor-parent",
      deletedAt: "2026-08-01T00:00:00.000Z",
    });
    await insertTasks([parent, child]);

    await restoreTask(child.id, "u1", NOW);

    expect((await findTaskById(parent.id))!.subtaskIds).toEqual([]);
    expect((await findTaskById(child.id))!.parentId).toBe("res-idor-parent");
  });

  it("does not write a foreign-list parent's subtaskIds on delete (legacy cross-list parentId)", async () => {
    const parent = makeTask({ id: "del-idor-parent", listId: "list-b", subtaskIds: ["del-idor-child"] });
    const child = makeTask({
      id: "del-idor-child",
      listId: "list-a",
      parentId: "del-idor-parent",
    });
    await insertTasks([parent, child]);

    await deleteTask(child.id, "u1", NOW);

    expect((await findTaskById(parent.id))!.subtaskIds).toEqual(["del-idor-child"]);
  });
});

describe("rollbackTask", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");
  const T1 = "2026-08-10T10:00:00.000Z";
  const T2 = "2026-08-11T10:00:00.000Z";

  it("restores updatable fields from the selected history index", async () => {
    const task = makeTask({
      id: "rb-restore",
      title: "C",
      priority: 5,
      history: [
        { field: "title", old: "A", new: "B", at: T1, byUserId: "u1" },
        { field: "title", old: "B", new: "C", at: T2, byUserId: "u1" },
        { field: "priority", old: 3, new: 5, at: T2, byUserId: "u1" },
      ],
    });
    await insertTasks([task]);

    const result = await rollbackTask(task.id, "u1", 0, NOW);

    expect(result.status).toBe("ok");
    const stored = (await findTaskById(task.id))!;
    expect(stored.title).toBe("A");
    expect(stored.priority).toBe(3);
  });

  it("keeps identity, createdAt, runtime timer fields, and deletedAt unchanged", async () => {
    const task = makeTask({
      id: "rb-identity",
      listId: "rb-list",
      code: "TEST-9",
      title: "B",
      createdAt: "2026-01-01T00:00:00.000Z",
      timeSpentMin: 40,
      timerStartedAt: T2,
      timerPausedAt: null,
      deletedAt: null,
      history: [{ field: "title", old: "A", new: "B", at: T1, byUserId: "u1" }],
    });
    await insertTasks([task]);

    await rollbackTask(task.id, "u1", 0, NOW);

    const stored = (await findTaskById(task.id))!;
    expect(stored.id).toBe("rb-identity");
    expect(stored.code).toBe("TEST-9");
    expect(stored.listId).toBe("rb-list");
    expect(stored.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(stored.timeSpentMin).toBe(40);
    expect(stored.timerStartedAt).toBe(T2);
    expect(stored.timerPausedAt).toBeNull();
    expect(stored.deletedAt).toBeNull();
  });

  it("appends a new history entry and keeps previous entries", async () => {
    const previous = [{ field: "title", old: "A", new: "B", at: T1, byUserId: "u1" }];
    const task = makeTask({ id: "rb-history", title: "B", history: previous });
    await insertTasks([task]);

    await rollbackTask(task.id, "u1", 0, NOW);

    const stored = (await findTaskById(task.id))!;
    expect(stored.history[0]).toEqual(previous[0]);
    expect(stored.history).toContainEqual({
      field: "title",
      old: "B",
      new: "A",
      at: NOW.toISOString(),
      byUserId: "u1",
    });
  });

  it("rejects an unknown history index without changing the task", async () => {
    const task = makeTask({
      id: "rb-unknown",
      title: "B",
      history: [{ field: "title", old: "A", new: "B", at: T1, byUserId: "u1" }],
    });
    await insertTasks([task]);

    expect(await rollbackTask(task.id, "u1", 9, NOW)).toEqual({ status: "unknown_version" });
    expect((await findTaskById(task.id))!.title).toBe("B");
    expect((await findTaskById(task.id))!.history).toHaveLength(1);
  });

  it("syncs parent subtaskIds when rolling back parentId", async () => {
    const parent = makeTask({ id: "rb-parent", listId: "rb-parent-list", subtaskIds: ["rb-child"] });
    const child = makeTask({
      id: "rb-child",
      listId: "rb-parent-list",
      parentId: "rb-parent",
      history: [{ field: "parentId", old: null, new: "rb-parent", at: T1, byUserId: "u1" }],
    });
    await insertTasks([parent, child]);

    const result = await rollbackTask(child.id, "u1", 0, NOW);

    expect(result.status).toBe("ok");
    expect((await findTaskById(child.id))!.parentId).toBeNull();
    expect((await findTaskById(parent.id))!.subtaskIds).toEqual([]);
  });

  it("rejects a restored parentId that is now invalid, without partial writes", async () => {
    const otherListParent = makeTask({ id: "rb-other-parent", listId: "other-list" });
    const child = makeTask({
      id: "rb-invalid-parent-child",
      listId: "this-list",
      parentId: null,
      history: [{ field: "parentId", old: "rb-other-parent", new: null, at: T1, byUserId: "u1" }],
    });
    await insertTasks([otherListParent, child]);

    expect(await rollbackTask(child.id, "u1", 0, NOW)).toEqual({ status: "invalid_parent" });
    expect((await findTaskById(child.id))!.parentId).toBeNull();
    expect((await findTaskById(child.id))!.history).toHaveLength(1);
  });

  it("rejects a restored dependsOn that would create a cycle, without persisting", async () => {
    const a = makeTask({
      id: "rb-dep-a",
      listId: "rb-dep-list",
      dependsOn: ["rb-dep-b"],
    });
    const b = makeTask({
      id: "rb-dep-b",
      listId: "rb-dep-list",
      dependsOn: [],
      history: [{ field: "dependsOn", old: ["rb-dep-a"], new: [], at: T1, byUserId: "u1" }],
    });
    await insertTasks([a, b]);

    expect(await rollbackTask(b.id, "u1", 0, NOW)).toEqual({ status: "cycle" });
    expect((await findTaskById(b.id))!.dependsOn).toEqual([]);
  });

  it("rejects a restored dependsOn that points at another list, without persisting", async () => {
    const foreign = makeTask({ id: "rb-dep-foreign", listId: "other-list" });
    const task = makeTask({
      id: "rb-dep-local",
      listId: "this-list",
      dependsOn: [],
      history: [{ field: "dependsOn", old: ["rb-dep-foreign"], new: [], at: T1, byUserId: "u1" }],
    });
    await insertTasks([foreign, task]);

    expect(await rollbackTask(task.id, "u1", 0, NOW)).toEqual({ status: "invalid_dependsOn" });
    expect((await findTaskById(task.id))!.dependsOn).toEqual([]);
  });

  it("returns not_found for a soft-deleted task", async () => {
    const task = makeTask({
      id: "rb-deleted",
      deletedAt: T1,
      history: [{ field: "title", old: "A", new: "B", at: T1, byUserId: "u1" }],
    });
    await insertTasks([task]);

    expect(await rollbackTask(task.id, "u1", 0, NOW)).toEqual({ status: "not_found" });
  });
});
