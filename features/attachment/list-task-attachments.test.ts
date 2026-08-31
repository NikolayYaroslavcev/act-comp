import { describe, expect, it } from "vitest";
import { listTaskAttachmentsForUser } from "@/features/attachment/list-task-attachments";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks } from "@/entities/task/repository";
import { createAttachment } from "@/entities/attachment/repository";

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

function bytes(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe("listTaskAttachmentsForUser", () => {
  it("returns the task's attachments for its owner", () => {
    const list = createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    const attachment = createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    const result = listTaskAttachmentsForUser("u-owner-1", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].id).toBe(attachment.id);
    }
  });

  it("allows a shared read-only user to list attachments", () => {
    const list = createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-viewer-2", access: "read" });
    const task = makeTaskIn(list.id);
    createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-2",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    const result = listTaskAttachmentsForUser("u-viewer-2", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.attachments).toHaveLength(1);
    }
  });

  it("returns not_found for a stranger's task, without leaking existence", () => {
    const list = createList("u-owner-3", { title: "Private", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = listTaskAttachmentsForUser("u-stranger-3", task.id);

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for an unknown task id", () => {
    expect(listTaskAttachmentsForUser("u-anyone-4", "does-not-exist").status).toBe("not_found");
  });

  it("returns not_found for a soft-deleted task, even for its owner", () => {
    const list = createList("u-owner-5", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    expect(listTaskAttachmentsForUser("u-owner-5", task.id).status).toBe("not_found");
  });

  it("returns not_found for a task in a soft-deleted list, even for the owner", () => {
    const list = createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    findListById(list.id)!.deletedAt = "2026-08-01T00:00:00.000Z";

    expect(listTaskAttachmentsForUser("u-owner-6", task.id).status).toBe("not_found");
  });

  it("returns an empty list for a task with no attachments", () => {
    const list = createList("u-owner-7", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const result = listTaskAttachmentsForUser("u-owner-7", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.attachments).toEqual([]);
    }
  });
});
