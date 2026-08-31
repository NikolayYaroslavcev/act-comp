import { describe, expect, it } from "vitest";
import { rollbackTaskForUser } from "@/features/task/rollback-task";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, findTaskById, insertTasks, updateTask } from "@/entities/task/repository";

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

describe("rollbackTaskForUser", () => {
  it("rolls back the task for its owner", () => {
    const list = createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u-owner-1", { title: "Updated" });

    const result = rollbackTaskForUser("u-owner-1", task.id, 0);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.title).toBe("Task");
    }
  });

  it("rolls back the task for a user with shared edit access", () => {
    const list = createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-editor-2", access: "edit" });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u-owner-2", { title: "Updated" });

    const result = rollbackTaskForUser("u-editor-2", task.id, 0);

    expect(result.status).toBe("ok");
  });

  it("returns forbidden for a user with only shared read access", () => {
    const list = createList("u-owner-3", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-viewer-3", access: "read" });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u-owner-3", { title: "Updated" });

    const result = rollbackTaskForUser("u-viewer-3", task.id, 0);

    expect(result.status).toBe("forbidden");
    expect(findTaskById(task.id)!.title).toBe("Updated");
  });

  it("returns not_found instead of leaking the existence of another user's task", () => {
    const list = createList("u-owner-4", { title: "Private", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u-owner-4", { title: "Updated" });

    const result = rollbackTaskForUser("u-stranger-4", task.id, 0);

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for an unknown task id", () => {
    const result = rollbackTaskForUser("u-anyone-5", "does-not-exist", 0);

    expect(result.status).toBe("not_found");
  });

  it("returns unknown_version for a history index that does not exist on this task", () => {
    const list = createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u-owner-6", { title: "Updated" });
    const other = makeTaskIn(list.id);
    updateTask(other.id, "u-owner-6", { title: "Other-1" });
    updateTask(other.id, "u-owner-6", { title: "Other-2" });

    const result = rollbackTaskForUser("u-owner-6", task.id, 1);

    expect(result.status).toBe("unknown_version");
    expect(findTaskById(task.id)!.title).toBe("Updated");
  });

  it("returns not_found for a soft-deleted task", () => {
    const list = createList("u-owner-7", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = rollbackTaskForUser("u-owner-7", task.id, 0);

    expect(result.status).toBe("not_found");
  });
});
