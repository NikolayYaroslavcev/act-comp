import { describe, expect, it } from "vitest";
import { updateTaskForUser } from "@/features/task/update-task";
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

describe("updateTaskForUser", () => {
  it("updates the task for its owner", async () => {
    const list = await createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await updateTaskForUser("u-owner-1", task.id, { title: "Updated" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.task.title).toBe("Updated");
    }
  });

  it("updates the task for a user with shared edit access", async () => {
    const list = await createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-editor-2", access: "edit" });
    const task = await makeTaskIn(list.id);

    const result = await updateTaskForUser("u-editor-2", task.id, { title: "Updated" });

    expect(result.status).toBe("ok");
  });

  it("returns forbidden for a user with only shared read access", async () => {
    const list = await createList("u-owner-3", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer-3", access: "read" });
    const task = await makeTaskIn(list.id);

    const result = await updateTaskForUser("u-viewer-3", task.id, { title: "Updated" });

    expect(result.status).toBe("forbidden");
    expect((await findTaskById(task.id))!.title).toBe("Task");
  });

  it("returns not_found instead of leaking the existence of another user's task", async () => {
    const list = await createList("u-owner-4", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await updateTaskForUser("u-stranger-4", task.id, { title: "Updated" });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for an unknown task id", async () => {
    const result = await updateTaskForUser("u-anyone-5", "does-not-exist", { title: "Updated" });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for a soft-deleted task", async () => {
    const list = await createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = await updateTaskForUser("u-owner-6", task.id, { title: "Updated" });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for a task in a soft-deleted list, even for its owner", async () => {
    const list = await createList("u-owner-7", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    (await findListById(list.id))!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = await updateTaskForUser("u-owner-7", task.id, { title: "Updated" });

    expect(result.status).toBe("not_found");
  });

  it("delegates domain-validation outcomes (e.g. a dependency cycle) to the repository", async () => {
    const list = await createList("u-owner-8", { title: "Owned", template: "work", deadline: null });
    const a = await makeTaskIn(list.id);
    const b = await makeTaskIn(list.id);
    await updateTaskForUser("u-owner-8", a.id, { dependsOn: [b.id] });

    const result = await updateTaskForUser("u-owner-8", b.id, { dependsOn: [a.id] });

    expect(result.status).toBe("cycle");
  });

  it("ignores an ownerId-like field spoofed in the input and derives access from the session user only", async () => {
    const list = await createList("u-owner-9", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await updateTaskForUser("u-stranger-9", task.id, {
      title: "Updated",
      // @ts-expect-error -- simulating a client attempting to smuggle extra fields
      ownerId: "u-owner-9",
    });

    expect(result.status).toBe("not_found");
  });
});
