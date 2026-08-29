import { describe, expect, it } from "vitest";
import { createTaskCommentForUser } from "@/features/comment/create-task-comment";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks } from "@/entities/task/repository";
import { listCommentsForTask } from "@/entities/comment/repository";

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

describe("createTaskCommentForUser", () => {
  it("creates a comment for the task's owner", () => {
    const list = createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = createTaskCommentForUser("u-owner-1", task.id, { text: "Hello" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.comment.taskId).toBe(task.id);
      expect(result.comment.authorId).toBe("u-owner-1");
      expect(result.comment.text).toBe("Hello");
    }
  });

  it("sets authorId from the given userId, ignoring any authorId the caller might pass in the input", () => {
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = createTaskCommentForUser("u1", task.id, { text: "Hello" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.comment.authorId).toBe("u1");
      expect(result.comment.authorEmail).toBe("admin@example.com");
    }
  });

  it("persists the comment so it is visible through listCommentsForTask", () => {
    const list = createList("u-owner-2", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = createTaskCommentForUser("u-owner-2", task.id, { text: "Hello" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(listCommentsForTask(task.id)).toEqual([
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

  it("allows a user with shared edit access to comment", () => {
    const list = createList("u-owner-3", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-editor-3", access: "edit" });
    const task = makeTaskIn(list.id);

    const result = createTaskCommentForUser("u-editor-3", task.id, { text: "Hello" });

    expect(result.status).toBe("ok");
  });

  it("returns forbidden for a user with only shared read access, without creating a comment", () => {
    const list = createList("u-owner-4", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-viewer-4", access: "read" });
    const task = makeTaskIn(list.id);

    const result = createTaskCommentForUser("u-viewer-4", task.id, { text: "Hello" });

    expect(result.status).toBe("forbidden");
    expect(listCommentsForTask(task.id)).toEqual([]);
  });

  it("returns not_found instead of leaking the existence of another user's task", () => {
    const list = createList("u-owner-5", { title: "Private", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = createTaskCommentForUser("u-stranger-5", task.id, { text: "Hello" });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for an unknown task id", () => {
    const result = createTaskCommentForUser("u-anyone-6", "does-not-exist", { text: "Hello" });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for a soft-deleted task, even for its owner", () => {
    const list = createList("u-owner-7", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = createTaskCommentForUser("u-owner-7", task.id, { text: "Hello" });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for a task in a soft-deleted list, even for the owner", () => {
    const list = createList("u-owner-8", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    findListById(list.id)!.deletedAt = "2026-08-01T00:00:00.000Z";

    const result = createTaskCommentForUser("u-owner-8", task.id, { text: "Hello" });

    expect(result.status).toBe("not_found");
  });
});
