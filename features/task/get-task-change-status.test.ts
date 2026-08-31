import { describe, expect, it } from "vitest";
import { getTaskChangeStatusForUser } from "@/features/task/get-task-change-status";
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

const T0 = "2026-08-30T09:00:00.000Z";
const T1 = "2026-08-30T10:00:00.000Z";

describe("getTaskChangeStatusForUser", () => {
  it("reports no change when nothing happened after `since`", () => {
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = getTaskChangeStatusForUser("u1", task.id, T1);

    expect(result).toEqual({
      status: "ok",
      changeStatus: {
        taskId: task.id,
        listId: list.id,
        changed: false,
        latestAt: null,
        actorUserId: null,
        actorEmail: null,
        changedFields: [],
        summary: null,
      },
    });
  });

  it("does not report the actor's own change", () => {
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u1", { priority: 5 }, new Date(T1));

    const result = getTaskChangeStatusForUser("u1", task.id, T0);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.changeStatus.changed).toBe(false);
    }
  });

  it("reports a change made by a different, authorized shared-read user", () => {
    const list = createList("u1", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u1", { priority: 5 }, new Date(T1));

    const result = getTaskChangeStatusForUser("u2", task.id, T0);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.changeStatus.changed).toBe(true);
      expect(result.changeStatus.actorUserId).toBe("u1");
      expect(result.changeStatus.actorEmail).toBe("admin@example.com");
      expect(result.changeStatus.changedFields).toContain("priority");
      expect(result.changeStatus.summary).toEqual(expect.stringContaining("admin@example.com"));
    }
  });

  it("reports a change made by a different, authorized shared-edit user", () => {
    const list = createList("u1", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u3", access: "edit" });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u1", { status: "in_progress" }, new Date(T1));

    const result = getTaskChangeStatusForUser("u3", task.id, T0);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.changeStatus.changed).toBe(true);
    }
  });

  it("does not leak change events to an unrelated user", () => {
    const list = createList("u1", { title: "Private", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u1", { priority: 5 }, new Date(T1));

    const result = getTaskChangeStatusForUser("u2", task.id, T0);

    expect(result).toEqual({ status: "not_found" });
  });

  it("does not leak change events for a soft-deleted task", () => {
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u1", { priority: 5 }, new Date(T1));
    insertTasks([{ ...task, priority: 5, deletedAt: "2026-08-31T00:00:00.000Z" }]);

    const result = getTaskChangeStatusForUser("u2", task.id, T0);

    expect(result).toEqual({ status: "not_found" });
  });

  it("stops reporting a change once access has been revoked", () => {
    const list = createList("u1", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u1", { priority: 5 }, new Date(T1));

    expect(getTaskChangeStatusForUser("u2", task.id, T0).status).toBe("ok");

    findListById(list.id)!.sharedWith = findListById(list.id)!.sharedWith.filter((share) => share.userId !== "u2");

    expect(getTaskChangeStatusForUser("u2", task.id, T0)).toEqual({ status: "not_found" });
  });

  it("returns not_found for an unknown task", () => {
    expect(getTaskChangeStatusForUser("u1", "does-not-exist", T0)).toEqual({ status: "not_found" });
  });

  it("does not include internal-only fields in the payload", () => {
    const list = createList("u1", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u1", { priority: 5 }, new Date(T1));

    const result = getTaskChangeStatusForUser("u2", task.id, T0);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(Object.keys(result.changeStatus).sort()).toEqual(
        ["actorEmail", "actorUserId", "changed", "changedFields", "latestAt", "listId", "summary", "taskId"].sort(),
      );
    }
  });

  it("collapses several field changes by the same other user into one change report", () => {
    const list = createList("u1", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u1", { priority: 5, category: "ops" }, new Date(T1));

    const result = getTaskChangeStatusForUser("u2", task.id, T0);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.changeStatus.changed).toBe(true);
      expect(result.changeStatus.changedFields.sort()).toEqual(["category", "priority"]);
    }
  });

  it("ignores recordActivity entries with no field metadata when listing changedFields, without crashing", () => {
    const list = createList("u1", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });
    const task = makeTaskIn(list.id);
    recordActivity({
      entityType: "task",
      entityId: task.id,
      action: "timer_started",
      at: T1,
      byUserId: "u1",
    });

    const result = getTaskChangeStatusForUser("u2", task.id, T0);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.changeStatus.changed).toBe(true);
      expect(result.changeStatus.changedFields).toEqual([]);
    }
  });
});
