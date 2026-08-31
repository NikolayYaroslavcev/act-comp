import { describe, expect, it } from "vitest";
import { deleteTaskForUser } from "@/features/task/delete-task";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, findTaskById, insertTasks } from "@/entities/task/repository";

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

describe("deleteTaskForUser", () => {
  it("soft-deletes the task for the list owner", async () => {
    const list = await createList("u-del-owner", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await deleteTaskForUser("u-del-owner", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.deletedAt).not.toBeNull();
    }
  });

  it("returns forbidden for a user with shared edit access (not the owner)", async () => {
    const list = await createList("u-del-owner2", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-del-editor2", access: "edit" });
    const task = await makeTaskIn(list.id);

    const result = await deleteTaskForUser("u-del-editor2", task.id);

    expect(result).toEqual({ status: "forbidden" });
    expect((await findTaskById(task.id))!.deletedAt).toBeNull();
  });

  it("returns forbidden for a user with shared read access", async () => {
    const list = await createList("u-del-owner3", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-del-viewer3", access: "read" });
    const task = await makeTaskIn(list.id);

    const result = await deleteTaskForUser("u-del-viewer3", task.id);

    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns not_found instead of leaking the existence of another user's task", async () => {
    const list = await createList("u-del-owner4", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await deleteTaskForUser("u-del-stranger4", task.id);

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for an unknown task id", async () => {
    const result = await deleteTaskForUser("u-del-anyone5", "does-not-exist");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a task in a soft-deleted list, even for its owner", async () => {
    const list = await createList("u-del-owner6", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    (await findListById(list.id))!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = await deleteTaskForUser("u-del-owner6", task.id);

    expect(result).toEqual({ status: "not_found" });
  });

  it("is idempotent: deleting an already soft-deleted task returns ok without changing deletedAt", async () => {
    const list = await createList("u-del-owner7", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const firstDeletedAt = "2026-08-01T00:00:00.000Z";
    await insertTasks([{ ...task, deletedAt: firstDeletedAt }]);

    const result = await deleteTaskForUser("u-del-owner7", task.id, new Date("2026-08-27T12:00:00.000Z"));

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.deletedAt).toBe(firstDeletedAt);
    }
  });
});
