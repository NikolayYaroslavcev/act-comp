import { describe, expect, it } from "vitest";
import { createComment, listCommentsForTask } from "@/entities/comment/repository";
import { getDb } from "@/shared/lib/db";

describe("createComment", () => {
  it("persists a comment with a generated id and the given fields", () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const comment = createComment({ taskId, authorId: "u1", text: "Hello" });

    expect(comment.id).toBeTruthy();
    expect(comment.taskId).toBe(taskId);
    expect(comment.authorId).toBe("u1");
    expect(comment.text).toBe("Hello");
  });

  it("stamps createdAt from the given now", () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const now = new Date("2026-08-20T10:00:00.000Z");

    const comment = createComment({ taskId, authorId: "u1", text: "Hello" }, now);

    expect(comment.createdAt).toBe("2026-08-20T10:00:00.000Z");
  });

  it("is visible through the shared storage consumer (listCommentsForTask)", () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const comment = createComment({ taskId, authorId: "u1", text: "Hello" });

    expect(listCommentsForTask(taskId)).toEqual([comment]);
  });

  it("stores the comment directly in the shared db under its id", () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const comment = createComment({ taskId, authorId: "u1", text: "Hello" });

    expect(getDb().comments[comment.id]).toEqual(comment);
  });
});

describe("listCommentsForTask", () => {
  it("returns only comments belonging to the given task", () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const otherTaskId = `task-${crypto.randomUUID()}`;
    const own = createComment({ taskId, authorId: "u1", text: "Mine" });
    createComment({ taskId: otherTaskId, authorId: "u1", text: "Not mine" });

    const result = listCommentsForTask(taskId);

    expect(result).toEqual([own]);
  });

  it("returns an empty array for a task with no comments", () => {
    const taskId = `task-${crypto.randomUUID()}`;

    expect(listCommentsForTask(taskId)).toEqual([]);
  });

  it("orders comments oldest to newest regardless of insertion order", () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const newer = createComment(
      { taskId, authorId: "u1", text: "Newer" },
      new Date("2026-08-20T12:00:00.000Z"),
    );
    const older = createComment(
      { taskId, authorId: "u1", text: "Older" },
      new Date("2026-08-20T08:00:00.000Z"),
    );

    const result = listCommentsForTask(taskId);

    expect(result.map((comment) => comment.id)).toEqual([older.id, newer.id]);
  });

  it("gives the same order on repeated calls (deterministic)", () => {
    const taskId = `task-${crypto.randomUUID()}`;
    createComment({ taskId, authorId: "u1", text: "A" }, new Date("2026-08-20T08:00:00.000Z"));
    createComment({ taskId, authorId: "u1", text: "B" }, new Date("2026-08-20T08:00:00.000Z"));

    const first = listCommentsForTask(taskId).map((comment) => comment.id);
    const second = listCommentsForTask(taskId).map((comment) => comment.id);

    expect(first).toEqual(second);
  });
});
