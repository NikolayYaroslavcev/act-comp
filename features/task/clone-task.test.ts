import { describe, expect, it } from "vitest";
import { cloneTaskForUser } from "@/features/task/clone-task";
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

describe("cloneTaskForUser", () => {
  it("clones the task for its owner", async () => {
    const list = await createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await cloneTaskForUser("u-owner-1", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.id).not.toBe(task.id);
      expect(result.task.listId).toBe(list.id);
    }
  });

  it("clones the task for a user with shared edit access", async () => {
    const list = await createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-editor-2", access: "edit" });
    const task = await makeTaskIn(list.id);

    const result = await cloneTaskForUser("u-editor-2", task.id);

    expect(result.status).toBe("ok");
  });

  it("returns forbidden for a user with only shared read access, without cloning", async () => {
    const list = await createList("u-owner-3", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer-3", access: "read" });
    const task = await makeTaskIn(list.id);

    const result = await cloneTaskForUser("u-viewer-3", task.id);

    expect(result.status).toBe("forbidden");
    expect((await findListById(list.id))!.taskIds).toEqual([task.id]);
  });

  it("returns not_found instead of leaking the existence of another user's task", async () => {
    const list = await createList("u-owner-4", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await cloneTaskForUser("u-stranger-4", task.id);

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for an unknown task id", async () => {
    const result = await cloneTaskForUser("u-anyone-5", "does-not-exist");

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for a task in a soft-deleted list, even for its owner", async () => {
    const list = await createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    (await findListById(list.id))!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = await cloneTaskForUser("u-owner-6", task.id);

    expect(result.status).toBe("not_found");
  });

  it("returns deleted for a soft-deleted source task, even for its owner", async () => {
    const list = await createList("u-owner-7", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = await cloneTaskForUser("u-owner-7", task.id);

    expect(result.status).toBe("deleted");
  });

  it("does not modify the source task", async () => {
    const list = await createList("u-owner-8", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const snapshot = { ...(await findTaskById(task.id))! };

    await cloneTaskForUser("u-owner-8", task.id);

    expect(await findTaskById(task.id)).toEqual(snapshot);
  });
});
