import { describe, expect, it } from "vitest";
import { listTaskActivityForUser } from "@/features/task/list-task-activity";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks, updateTask } from "@/entities/task/repository";
import { recordActivity } from "@/entities/activity/repository";

async function makeTaskIn(listId: string) {
  return await createTask({
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
  it("returns activity for the owner, with actor email resolved", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await updateTask(task.id, "u1", { priority: 5 });

    const result = await listTaskActivityForUser("u1", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.activity.some((item) => item.action === "updated" && item.actorEmail === "admin@example.com")).toBe(
        true,
      );
    }
  });

  it("returns activity for shared-read and shared-edit", async () => {
    const list = await createList("u1", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" }, { userId: "u3", access: "edit" });
    const task = await makeTaskIn(list.id);
    await recordActivity({
      entityType: "task",
      entityId: task.id,
      action: "created",
      at: "2026-08-30T10:00:00.000Z",
      byUserId: "u1",
    });

    expect((await listTaskActivityForUser("u2", task.id)).status).toBe("ok");
    expect((await listTaskActivityForUser("u3", task.id)).status).toBe("ok");
  });

  it("returns not_found for a private task of another user", async () => {
    const list = await createList("u1", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    expect(await listTaskActivityForUser("u2", task.id)).toEqual({ status: "not_found" });
  });

  it("returns not_found for an unknown task", async () => {
    expect(await listTaskActivityForUser("u1", "does-not-exist")).toEqual({ status: "not_found" });
  });

  it("returns not_found for a soft-deleted task", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    expect(await listTaskActivityForUser("u1", task.id)).toEqual({ status: "not_found" });
  });

  it("does not return another task's activity", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const other = await makeTaskIn(list.id);
    await recordActivity({
      entityType: "task",
      entityId: other.id,
      action: "created",
      at: "2026-08-30T10:00:00.000Z",
      byUserId: "u1",
    });

    const result = await listTaskActivityForUser("u1", task.id);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.activity.every((item) => item.entityId === task.id)).toBe(true);
    }
  });
});
