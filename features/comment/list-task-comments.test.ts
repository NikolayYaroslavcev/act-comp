import { describe, expect, it } from "vitest";
import { listTaskCommentsForUser } from "@/features/comment/list-task-comments";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks } from "@/entities/task/repository";
import { createComment } from "@/entities/comment/repository";

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

describe("listTaskCommentsForUser", () => {
  it("returns the task's comments for its owner", async () => {
    const list = await createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const comment = await createComment({ taskId: task.id, authorId: "u-owner-1", text: "Hi" });

    const result = await listTaskCommentsForUser("u-owner-1", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].id).toBe(comment.id);
    }
  });

  it("resolves the author's email onto each comment", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await createComment({ taskId: task.id, authorId: "u1", text: "Hi" });

    const result = await listTaskCommentsForUser("u1", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.comments[0].authorEmail).toBe("admin@example.com");
    }
  });

  it("returns comments for a user with shared read access", async () => {
    const list = await createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer-2", access: "read" });
    const task = await makeTaskIn(list.id);
    await createComment({ taskId: task.id, authorId: "u-owner-2", text: "Hi" });

    const result = await listTaskCommentsForUser("u-viewer-2", task.id);

    expect(result.status).toBe("ok");
  });

  it("does not return another task's comments", async () => {
    const list = await createList("u-owner-3", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const otherTask = await makeTaskIn(list.id);
    await createComment({ taskId: otherTask.id, authorId: "u-owner-3", text: "Not this one" });

    const result = await listTaskCommentsForUser("u-owner-3", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.comments).toEqual([]);
    }
  });

  it("returns not_found for an unknown task id", async () => {
    expect(await listTaskCommentsForUser("u-anyone-4", "does-not-exist")).toEqual({ status: "not_found" });
  });

  it("returns not_found instead of leaking the existence of another user's task", async () => {
    const list = await createList("u-owner-5", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await listTaskCommentsForUser("u-stranger-5", task.id);

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for a soft-deleted task", async () => {
    const list = await createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = await listTaskCommentsForUser("u-owner-6", task.id);

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for a task in a soft-deleted list, even for the owner", async () => {
    const list = await createList("u-owner-7", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    (await findListById(list.id))!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = await listTaskCommentsForUser("u-owner-7", task.id);

    expect(result.status).toBe("not_found");
  });
});
