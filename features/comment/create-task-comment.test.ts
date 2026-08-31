import { describe, expect, it } from "vitest";
import { createTaskCommentForUser } from "@/features/comment/create-task-comment";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, findTaskById, insertTasks } from "@/entities/task/repository";
import { listCommentsForTask } from "@/entities/comment/repository";

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

describe("createTaskCommentForUser", () => {
  it("creates a comment for the task's owner", async () => {
    const list = await createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await createTaskCommentForUser("u-owner-1", task.id, { text: "Hello" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.comment.taskId).toBe(task.id);
      expect(result.comment.authorId).toBe("u-owner-1");
      expect(result.comment.text).toBe("Hello");
    }
  });

  it("sets authorId from the given userId, ignoring any authorId the caller might pass in the input", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await createTaskCommentForUser("u1", task.id, { text: "Hello" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.comment.authorId).toBe("u1");
      expect(result.comment.authorEmail).toBe("admin@example.com");
    }
  });

  it("persists the comment so it is visible through listCommentsForTask", async () => {
    const list = await createList("u-owner-2", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await createTaskCommentForUser("u-owner-2", task.id, { text: "Hello" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(await listCommentsForTask(task.id)).toEqual([
        {
          id: result.comment.id,
          taskId: result.comment.taskId,
          authorId: result.comment.authorId,
          text: result.comment.text,
          createdAt: result.comment.createdAt,
        },
      ]);
    }
  });

  it("allows a user with shared edit access to comment", async () => {
    const list = await createList("u-owner-3", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-editor-3", access: "edit" });
    const task = await makeTaskIn(list.id);

    const result = await createTaskCommentForUser("u-editor-3", task.id, { text: "Hello" });

    expect(result.status).toBe("ok");
  });

  it("returns forbidden for a user with only shared read access, without creating a comment", async () => {
    const list = await createList("u-owner-4", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer-4", access: "read" });
    const task = await makeTaskIn(list.id);

    const result = await createTaskCommentForUser("u-viewer-4", task.id, { text: "Hello" });

    expect(result.status).toBe("forbidden");
    expect(await listCommentsForTask(task.id)).toEqual([]);
  });

  it("returns not_found instead of leaking the existence of another user's task", async () => {
    const list = await createList("u-owner-5", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await createTaskCommentForUser("u-stranger-5", task.id, { text: "Hello" });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for an unknown task id", async () => {
    const result = await createTaskCommentForUser("u-anyone-6", "does-not-exist", { text: "Hello" });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for a soft-deleted task, even for its owner", async () => {
    const list = await createList("u-owner-7", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = await createTaskCommentForUser("u-owner-7", task.id, { text: "Hello" });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for a task in a soft-deleted list, even for the owner", async () => {
    const list = await createList("u-owner-8", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    (await findListById(list.id))!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = await createTaskCommentForUser("u-owner-8", task.id, { text: "Hello" });

    expect(result.status).toBe("not_found");
  });
});

describe("createTaskCommentForUser time extension syntax", () => {
  it("extends estimatedMin by 60 when the comment contains %1h%", async () => {
    const list = await createList("u-ext-1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await createTaskCommentForUser("u-ext-1", task.id, { text: "Extending by %1h%" });

    expect(result.status).toBe("ok");
    expect((await findTaskById(task.id))!.estimatedMin).toBe(60);
  });

  it("extends estimatedMin by 30 when the comment contains %30m%", async () => {
    const list = await createList("u-ext-2", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    await createTaskCommentForUser("u-ext-2", task.id, { text: "%30m% more needed" });

    expect((await findTaskById(task.id))!.estimatedMin).toBe(30);
  });

  it("records the extension against the newly created comment's id", async () => {
    const list = await createList("u-ext-3", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await createTaskCommentForUser("u-ext-3", task.id, { text: "%1h%" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect((await findTaskById(task.id))!.extensions).toEqual([{ commentId: result.comment.id, addedMin: 60 }]);
    }
  });

  it("does not change estimatedMin for a plain comment without extension syntax", async () => {
    const list = await createList("u-ext-4", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    await createTaskCommentForUser("u-ext-4", task.id, { text: "Just a regular comment" });

    expect((await findTaskById(task.id))!.estimatedMin).toBe(0);
    expect((await findTaskById(task.id))!.extensions).toEqual([]);
  });

  it("does not change estimatedMin for malformed extension syntax, and still saves the comment text verbatim", async () => {
    const list = await createList("u-ext-5", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await createTaskCommentForUser("u-ext-5", task.id, { text: "%1x% is not a valid unit" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.comment.text).toBe("%1x% is not a valid unit");
    }
    expect((await findTaskById(task.id))!.estimatedMin).toBe(0);
  });

  it("extends estimatedMin by 310 from a single %5h 10m% comment, with one extension record", async () => {
    const list = await createList("u-ext-combined", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await createTaskCommentForUser("u-ext-combined", task.id, { text: "Need %5h 10m% more" });

    expect(result.status).toBe("ok");
    const stored = (await findTaskById(task.id))!;
    expect(stored.estimatedMin).toBe(310);
    expect(stored.extensions).toHaveLength(1);
    expect(stored.extensions[0]?.addedMin).toBe(310);
    if (result.status === "ok") {
      expect(stored.extensions[0]?.commentId).toBe(result.comment.id);
    }
  });

  it("applies extensions from independent comments cumulatively, not doubled", async () => {
    const list = await createList("u-ext-6", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    await createTaskCommentForUser("u-ext-6", task.id, { text: "%1h%" });
    await createTaskCommentForUser("u-ext-6", task.id, { text: "%30m%" });

    const stored = (await findTaskById(task.id))!;
    expect(stored.estimatedMin).toBe(90);
    expect(stored.extensions).toHaveLength(2);
  });

  it("does not extend a task when the commenter only has shared read access", async () => {
    const list = await createList("u-ext-7", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-ext-viewer-7", access: "read" });
    const task = await makeTaskIn(list.id);

    const result = await createTaskCommentForUser("u-ext-viewer-7", task.id, { text: "%1h%" });

    expect(result.status).toBe("forbidden");
    expect((await findTaskById(task.id))!.estimatedMin).toBe(0);
  });

  it("does not extend an unknown task", async () => {
    const result = await createTaskCommentForUser("u-ext-8", "does-not-exist", { text: "%1h%" });
    expect(result.status).toBe("not_found");
  });

  it("does not extend a soft-deleted task", async () => {
    const list = await createList("u-ext-9", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = await createTaskCommentForUser("u-ext-9", task.id, { text: "%1h%" });

    expect(result.status).toBe("not_found");
  });
});
