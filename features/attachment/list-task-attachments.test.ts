import { describe, expect, it } from "vitest";
import { listTaskAttachmentsForUser } from "@/features/attachment/list-task-attachments";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks } from "@/entities/task/repository";
import { createAttachment } from "@/entities/attachment/repository";

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

function bytes(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe("listTaskAttachmentsForUser", () => {
  it("returns the task's attachments for its owner", async () => {
    const list = await createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    const result = await listTaskAttachmentsForUser("u-owner-1", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].id).toBe(attachment.id);
    }
  });

  it("allows a shared read-only user to list attachments", async () => {
    const list = await createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer-2", access: "read" });
    const task = await makeTaskIn(list.id);
    await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-2",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    const result = await listTaskAttachmentsForUser("u-viewer-2", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.attachments).toHaveLength(1);
    }
  });

  it("returns not_found for a stranger's task, without leaking existence", async () => {
    const list = await createList("u-owner-3", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await listTaskAttachmentsForUser("u-stranger-3", task.id);

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for an unknown task id", async () => {
    expect((await listTaskAttachmentsForUser("u-anyone-4", "does-not-exist")).status).toBe("not_found");
  });

  it("returns not_found for a soft-deleted task, even for its owner", async () => {
    const list = await createList("u-owner-5", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    expect((await listTaskAttachmentsForUser("u-owner-5", task.id)).status).toBe("not_found");
  });

  it("returns not_found for a task in a soft-deleted list, even for the owner", async () => {
    const list = await createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    (await findListById(list.id))!.deletedAt = "2026-08-01T00:00:00.000Z";

    expect((await listTaskAttachmentsForUser("u-owner-6", task.id)).status).toBe("not_found");
  });

  it("returns an empty list for a task with no attachments", async () => {
    const list = await createList("u-owner-7", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await listTaskAttachmentsForUser("u-owner-7", task.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.attachments).toEqual([]);
    }
  });
});
