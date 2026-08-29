import { describe, expect, it } from "vitest";
import { restoreTaskForUser } from "@/features/task/restore-task";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, findTaskById, insertTasks } from "@/entities/task/repository";

function makeTaskIn(listId: string) {
  return createTask({
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
}

describe("restoreTaskForUser", () => {
  const NOW = new Date("2026-08-27T12:00:00.000Z");

  it("restores the task for the list owner within the restore window", () => {
    const list = createList("u-res-owner", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = restoreTaskForUser("u-res-owner", task.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.deletedAt).toBeNull();
    }
  });

  it("returns forbidden for a user with shared edit access (not the owner)", () => {
    const list = createList("u-res-owner2", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-res-editor2", access: "edit" });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = restoreTaskForUser("u-res-editor2", task.id, NOW);

    expect(result).toEqual({ status: "forbidden" });
    expect(findTaskById(task.id)!.deletedAt).not.toBeNull();
  });

  it("returns forbidden for a user with shared read access", () => {
    const list = createList("u-res-owner3", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-res-viewer3", access: "read" });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = restoreTaskForUser("u-res-viewer3", task.id, NOW);

    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns not_found instead of leaking the existence of another user's task", () => {
    const list = createList("u-res-owner4", { title: "Private", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = restoreTaskForUser("u-res-stranger4", task.id, NOW);

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for an unknown task id", () => {
    const result = restoreTaskForUser("u-res-anyone5", "does-not-exist", NOW);
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a task in a soft-deleted list, even for its owner", () => {
    const list = createList("u-res-owner6", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);
    findListById(list.id)!.deletedAt = "2026-08-02T00:00:00.000Z";

    const result = restoreTaskForUser("u-res-owner6", task.id, NOW);

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns expired when the restore window has passed", () => {
    const list = createList("u-res-owner7", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-01-01T00:00:00.000Z" }]);

    const result = restoreTaskForUser("u-res-owner7", task.id, NOW);

    expect(result).toEqual({ status: "expired" });
    expect(findTaskById(task.id)!.deletedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("is idempotent: restoring a task that is not deleted returns ok without changing history", () => {
    const list = createList("u-res-owner8", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = restoreTaskForUser("u-res-owner8", task.id, NOW);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.deletedAt).toBeNull();
    }
    expect(findTaskById(task.id)!.history).toEqual([]);
  });

  it("defaults `now` to the current time when not provided", () => {
    const list = createList("u-res-owner9", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: new Date().toISOString() }]);

    const result = restoreTaskForUser("u-res-owner9", task.id);

    expect(result.status).toBe("ok");
  });
});
