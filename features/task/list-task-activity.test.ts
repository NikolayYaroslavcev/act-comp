import { describe, expect, it } from "vitest";
import { listTaskActivityForUser } from "@/features/task/list-task-activity";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks, updateTask } from "@/entities/task/repository";
import { recordActivity } from "@/entities/activity/repository";

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

describe("listTaskActivityForUser", () => {
  it("returns activity for the owner, with actor email resolved", () => {
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u1", { priority: 5 });

    const result = listTaskActivityForUser("u1", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.activity.some((item) => item.action === "updated" && item.actorEmail === "admin@example.com")).toBe(
        true,
      );
    }
  });

  it("returns activity for shared-read and shared-edit", () => {
    const list = createList("u1", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" }, { userId: "u3", access: "edit" });
    const task = makeTaskIn(list.id);
    recordActivity({
      entityType: "task",
      entityId: task.id,
      action: "created",
      at: "2026-08-30T10:00:00.000Z",
      byUserId: "u1",
    });

    expect(listTaskActivityForUser("u2", task.id).status).toBe("ok");
    expect(listTaskActivityForUser("u3", task.id).status).toBe("ok");
  });

  it("returns not_found for a private task of another user", () => {
    const list = createList("u1", { title: "Private", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    expect(listTaskActivityForUser("u2", task.id)).toEqual({ status: "not_found" });
  });

  it("returns not_found for an unknown task", () => {
    expect(listTaskActivityForUser("u1", "does-not-exist")).toEqual({ status: "not_found" });
  });

  it("returns not_found for a soft-deleted task", () => {
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    expect(listTaskActivityForUser("u1", task.id)).toEqual({ status: "not_found" });
  });

  it("does not return another task's activity", () => {
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    const other = makeTaskIn(list.id);
    recordActivity({
      entityType: "task",
      entityId: other.id,
      action: "created",
      at: "2026-08-30T10:00:00.000Z",
      byUserId: "u1",
    });

    const result = listTaskActivityForUser("u1", task.id);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.activity.every((item) => item.entityId === task.id)).toBe(true);
    }
  });
});
