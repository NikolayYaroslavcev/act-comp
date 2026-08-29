import { describe, expect, it } from "vitest";
import { deleteTaskForUser } from "@/features/task/delete-task";
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

describe("deleteTaskForUser", () => {
  it("soft-deletes the task for the list owner", () => {
    const list = createList("u-del-owner", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = deleteTaskForUser("u-del-owner", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.deletedAt).not.toBeNull();
    }
  });

  it("returns forbidden for a user with shared edit access (not the owner)", () => {
    const list = createList("u-del-owner2", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-del-editor2", access: "edit" });
    const task = makeTaskIn(list.id);

    const result = deleteTaskForUser("u-del-editor2", task.id);

    expect(result).toEqual({ status: "forbidden" });
    expect(findTaskById(task.id)!.deletedAt).toBeNull();
  });

  it("returns forbidden for a user with shared read access", () => {
    const list = createList("u-del-owner3", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-del-viewer3", access: "read" });
    const task = makeTaskIn(list.id);

    const result = deleteTaskForUser("u-del-viewer3", task.id);

    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns not_found instead of leaking the existence of another user's task", () => {
    const list = createList("u-del-owner4", { title: "Private", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = deleteTaskForUser("u-del-stranger4", task.id);

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for an unknown task id", () => {
    const result = deleteTaskForUser("u-del-anyone5", "does-not-exist");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a task in a soft-deleted list, even for its owner", () => {
    const list = createList("u-del-owner6", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    findListById(list.id)!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = deleteTaskForUser("u-del-owner6", task.id);

    expect(result).toEqual({ status: "not_found" });
  });

  it("is idempotent: deleting an already soft-deleted task returns ok without changing deletedAt", () => {
    const list = createList("u-del-owner7", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    const firstDeletedAt = "2026-08-01T00:00:00.000Z";
    insertTasks([{ ...task, deletedAt: firstDeletedAt }]);

    const result = deleteTaskForUser("u-del-owner7", task.id, new Date("2026-08-27T12:00:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.deletedAt).toBe(firstDeletedAt);
    }
  });
});
