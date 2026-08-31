import { describe, expect, it } from "vitest";
import { getVisibleTask } from "@/features/task/get-task";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks } from "@/entities/task/repository";

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

describe("getVisibleTask", () => {
  it("returns the task for its owner", async () => {
    const list = await createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await getVisibleTask("u-owner-1", task.id);

    expect(result).toEqual({ status: "ok", task });
  });

  it("returns the task for a user it is shared with", async () => {
    const list = await createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer-2", access: "read" });
    const task = await makeTaskIn(list.id);

    const result = await getVisibleTask("u-viewer-2", task.id);

    expect(result).toEqual({ status: "ok", task });
  });

  it("returns not_found for an unknown task id", async () => {
    expect(await getVisibleTask("u-anyone-3", "does-not-exist")).toEqual({ status: "not_found" });
  });

  it("returns not_found instead of leaking the existence of another user's task", async () => {
    const list = await createList("u-owner-4", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await getVisibleTask("u-stranger-4", task.id);

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a soft-deleted task", async () => {
    const list = await createList("u-owner-5", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = await getVisibleTask("u-owner-5", task.id);

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a task in a soft-deleted list, even for the owner", async () => {
    const list = await createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    (await findListById(list.id))!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = await getVisibleTask("u-owner-6", task.id);

    expect(result).toEqual({ status: "not_found" });
  });
});
