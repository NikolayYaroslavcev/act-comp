import { describe, expect, it } from "vitest";
import { createComment, listCommentsForTask } from "@/entities/comment/repository";
import { getDb } from "@/shared/lib/db";

describe("createComment", () => {
  it("persists a comment with a generated id and the given fields", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const comment = await createComment({ taskId, authorId: "u1", text: "Hello" });

    expect(comment.id).toBeTruthy();
    expect(comment.taskId).toBe(taskId);
    expect(comment.authorId).toBe("u1");
    expect(comment.text).toBe("Hello");
  });

  it("stamps createdAt from the given now", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const now = new Date("2026-08-20T10:00:00.000Z");

    const comment = await createComment({ taskId, authorId: "u1", text: "Hello" }, now);

    expect(comment.createdAt).toBe("2026-08-20T10:00:00.000Z");
  });

  it("is visible through the shared storage consumer (listCommentsForTask)", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const comment = await createComment({ taskId, authorId: "u1", text: "Hello" });

    expect(await listCommentsForTask(taskId)).toEqual([comment]);
  });

  it("stores the comment directly in the shared db under its id", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const comment = await createComment({ taskId, authorId: "u1", text: "Hello" });

    expect((await getDb()).comments[comment.id]).toEqual(comment);
  });
});

describe("listCommentsForTask", () => {
  it("returns only comments belonging to the given task", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const otherTaskId = `task-${crypto.randomUUID()}`;
    const own = await createComment({ taskId, authorId: "u1", text: "Mine" });
    await createComment({ taskId: otherTaskId, authorId: "u1", text: "Not mine" });

    const result = await listCommentsForTask(taskId);

    expect(result).toEqual([own]);
  });

  it("returns an empty array for a task with no comments", async () => {
    const taskId = `task-${crypto.randomUUID()}`;

    expect(await listCommentsForTask(taskId)).toEqual([]);
  });

  it("orders comments oldest to newest regardless of insertion order", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const newer = await createComment(
      { taskId, authorId: "u1", text: "Newer" },
      new Date("2026-08-20T12:00:00.000Z"),
    );
    const older = await createComment(
      { taskId, authorId: "u1", text: "Older" },
      new Date("2026-08-20T08:00:00.000Z"),
    );

    const result = await listCommentsForTask(taskId);

    expect(result.map((comment) => comment.id)).toEqual([older.id, newer.id]);
  });

  it("gives the same order on repeated calls (deterministic)", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    await createComment({ taskId, authorId: "u1", text: "A" }, new Date("2026-08-20T08:00:00.000Z"));
    await createComment({ taskId, authorId: "u1", text: "B" }, new Date("2026-08-20T08:00:00.000Z"));

    const first = (await listCommentsForTask(taskId)).map((comment) => comment.id);
    const second = (await listCommentsForTask(taskId)).map((comment) => comment.id);

    expect(first).toEqual(second);
  });
});
