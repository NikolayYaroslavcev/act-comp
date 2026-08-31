import { describe, expect, it } from "vitest";
import { deleteTaskAttachmentForUser } from "@/features/attachment/delete-task-attachment";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks } from "@/entities/task/repository";
import { createAttachment, findAttachmentById, readAttachmentBytes } from "@/entities/attachment/repository";
import { listActivityForTask } from "@/entities/activity/repository";

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

describe("deleteTaskAttachmentForUser", () => {
  it("deletes the attachment for the task's owner, removing metadata and bytes", async () => {
    const list = await createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1, 2, 3]),
    });

    const result = await deleteTaskAttachmentForUser("u-owner-1", task.id, attachment.id);

    expect(result.status).toBe("ok");
    expect(await findAttachmentById(attachment.id)).toBeUndefined();
    expect(await readAttachmentBytes(attachment)).toBeUndefined();
  });

  it("allows a user with shared edit access to delete", async () => {
    const list = await createList("u-owner-2", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-editor-2", access: "edit" });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-2",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect((await deleteTaskAttachmentForUser("u-editor-2", task.id, attachment.id)).status).toBe("ok");
  });

  it("returns forbidden for a user with only shared read access, without deleting", async () => {
    const list = await createList("u-owner-3", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer-3", access: "read" });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-3",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    const result = await deleteTaskAttachmentForUser("u-viewer-3", task.id, attachment.id);

    expect(result.status).toBe("forbidden");
    expect(await findAttachmentById(attachment.id)).toBeDefined();
  });

  it("returns not_found instead of leaking the existence of a stranger's task", async () => {
    const list = await createList("u-owner-4", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-4",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect((await deleteTaskAttachmentForUser("u-stranger-4", task.id, attachment.id)).status).toBe("not_found");
  });

  it("returns not_found for an unknown attachment id", async () => {
    const list = await createList("u-owner-5", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    expect((await deleteTaskAttachmentForUser("u-owner-5", task.id, "does-not-exist")).status).toBe("not_found");
  });

  it("returns not_found when the attachment belongs to a different task than the one in the URL (no IDOR via mismatched ids)", async () => {
    const list = await createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    const taskA = await makeTaskIn(list.id);
    const taskB = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: taskA.id,
      uploadedBy: "u-owner-6",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    const result = await deleteTaskAttachmentForUser("u-owner-6", taskB.id, attachment.id);

    expect(result.status).toBe("not_found");
    expect(await findAttachmentById(attachment.id)).toBeDefined();
  });

  it("returns not_found for a soft-deleted task, even for its owner", async () => {
    const list = await createList("u-owner-7", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-7",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    expect((await deleteTaskAttachmentForUser("u-owner-7", task.id, attachment.id)).status).toBe("not_found");
  });

  it("returns not_found (not a crash) when deleting the same attachment twice", async () => {
    const list = await createList("u-owner-8", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-8",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect((await deleteTaskAttachmentForUser("u-owner-8", task.id, attachment.id)).status).toBe("ok");
    expect((await deleteTaskAttachmentForUser("u-owner-8", task.id, attachment.id)).status).toBe("not_found");
  });
});

describe("deleteTaskAttachmentForUser activity logging", () => {
  it("records an attachment_deleted activity for the deleting user after a successful delete", async () => {
    const list = await createList("u-owner-30", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-30",
      filename: "report.pdf",
      mimeType: "application/pdf",
      bytes: bytes([1, 2, 3]),
    });

    const result = await deleteTaskAttachmentForUser("u-owner-30", task.id, attachment.id);

    expect(result.status).toBe("ok");
    const activity = await listActivityForTask(task.id);
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      entityType: "task",
      entityId: task.id,
      action: "attachment_deleted",
      byUserId: "u-owner-30",
    });
    expect(activity[0].metadata).toMatchObject({
      attachmentId: attachment.id,
      filename: "report.pdf",
    });
  });

  it("does not record activity when the delete is forbidden (shared read-only access)", async () => {
    const list = await createList("u-owner-31", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer-31", access: "read" });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-31",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    await deleteTaskAttachmentForUser("u-viewer-31", task.id, attachment.id);

    expect(await listActivityForTask(task.id)).toEqual([]);
  });

  it("does not record activity when the attachment id does not exist", async () => {
    const list = await createList("u-owner-32", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    await deleteTaskAttachmentForUser("u-owner-32", task.id, "does-not-exist");

    expect(await listActivityForTask(task.id)).toEqual([]);
  });

  it("does not double-record activity when deleting the same attachment twice", async () => {
    const list = await createList("u-owner-33", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-33",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    await deleteTaskAttachmentForUser("u-owner-33", task.id, attachment.id);
    await deleteTaskAttachmentForUser("u-owner-33", task.id, attachment.id);

    expect(await listActivityForTask(task.id)).toHaveLength(1);
  });
});
