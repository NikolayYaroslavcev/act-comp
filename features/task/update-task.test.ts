import { describe, expect, it } from "vitest";
import { updateTaskForUser } from "@/features/task/update-task";
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

describe("updateTaskForUser", () => {
  it("updates the task for its owner", () => {
    const list = createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = updateTaskForUser("u-owner-1", task.id, { title: "Updated" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.title).toBe("Updated");
    }
  });

  it("updates the task for a user with shared edit access", () => {
    const list = createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-editor-2", access: "edit" });
    const task = makeTaskIn(list.id);

    const result = updateTaskForUser("u-editor-2", task.id, { title: "Updated" });

    expect(result.status).toBe("ok");
  });

  it("returns forbidden for a user with only shared read access", () => {
    const list = createList("u-owner-3", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-viewer-3", access: "read" });
    const task = makeTaskIn(list.id);

    const result = updateTaskForUser("u-viewer-3", task.id, { title: "Updated" });

    expect(result.status).toBe("forbidden");
    expect(findTaskById(task.id)!.title).toBe("Task");
  });

  it("returns not_found instead of leaking the existence of another user's task", () => {
    const list = createList("u-owner-4", { title: "Private", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = updateTaskForUser("u-stranger-4", task.id, { title: "Updated" });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for an unknown task id", () => {
    const result = updateTaskForUser("u-anyone-5", "does-not-exist", { title: "Updated" });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for a soft-deleted task", () => {
    const list = createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = updateTaskForUser("u-owner-6", task.id, { title: "Updated" });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for a task in a soft-deleted list, even for its owner", () => {
    const list = createList("u-owner-7", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    findListById(list.id)!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = updateTaskForUser("u-owner-7", task.id, { title: "Updated" });

    expect(result.status).toBe("not_found");
  });

  it("delegates domain-validation outcomes (e.g. a dependency cycle) to the repository", () => {
    const list = createList("u-owner-8", { title: "Owned", template: "work", deadline: null });
    const a = makeTaskIn(list.id);
    const b = makeTaskIn(list.id);
    updateTaskForUser("u-owner-8", a.id, { dependsOn: [b.id] });

    const result = updateTaskForUser("u-owner-8", b.id, { dependsOn: [a.id] });

    expect(result.status).toBe("cycle");
  });

  it("ignores an ownerId-like field spoofed in the input and derives access from the session user only", () => {
    const list = createList("u-owner-9", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = updateTaskForUser("u-stranger-9", task.id, {
      title: "Updated",
      // @ts-expect-error -- simulating a client attempting to smuggle extra fields
      ownerId: "u-owner-9",
    });

    expect(result.status).toBe("not_found");
  });
});
