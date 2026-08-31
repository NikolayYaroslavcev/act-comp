import { describe, expect, it } from "vitest";
import { uploadTaskAttachmentForUser } from "@/features/attachment/upload-task-attachment";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks } from "@/entities/task/repository";
import { listAttachmentsForTask } from "@/entities/attachment/repository";
import { MAX_ATTACHMENT_SIZE_BYTES } from "@/entities/attachment/model";
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

describe("uploadTaskAttachmentForUser", () => {
  it("uploads a file for the task's owner", async () => {
    const list = await createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await uploadTaskAttachmentForUser("u-owner-1", task.id, {
      filename: "report.pdf",
      mimeType: "application/pdf",
      bytes: bytes([1, 2, 3]),
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.attachment.taskId).toBe(task.id);
      expect(result.attachment.filename).toBe("report.pdf");
      expect(result.attachment.uploadedBy).toBe("u-owner-1");
      expect(result.attachment.size).toBe(3);
    }
  });

  it("persists the upload so it is visible through listAttachmentsForTask", async () => {
    const list = await createList("u-owner-2", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await uploadTaskAttachmentForUser("u-owner-2", task.id, {
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(result.status).toBe("ok");
    expect(await listAttachmentsForTask(task.id)).toHaveLength(1);
  });

  it("preserves a Unicode filename", async () => {
    const list = await createList("u-owner-3", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await uploadTaskAttachmentForUser("u-owner-3", task.id, {
      filename: "Отчёт по задаче №1.pdf",
      mimeType: "application/pdf",
      bytes: bytes([1]),
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.attachment.filename).toBe("Отчёт по задаче №1.pdf");
    }
  });

  it("allows duplicate filenames on the same task", async () => {
    const list = await createList("u-owner-4", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    await uploadTaskAttachmentForUser("u-owner-4", task.id, {
      filename: "same.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });
    const second = await uploadTaskAttachmentForUser("u-owner-4", task.id, {
      filename: "same.txt",
      mimeType: "text/plain",
      bytes: bytes([2]),
    });

    expect(second.status).toBe("ok");
    expect(await listAttachmentsForTask(task.id)).toHaveLength(2);
  });

  it("allows a user with shared edit access to upload", async () => {
    const list = await createList("u-owner-5", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-editor-5", access: "edit" });
    const task = await makeTaskIn(list.id);

    const result = await uploadTaskAttachmentForUser("u-editor-5", task.id, {
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(result.status).toBe("ok");
  });

  it("returns forbidden for a user with only shared read access, without uploading", async () => {
    const list = await createList("u-owner-6", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer-6", access: "read" });
    const task = await makeTaskIn(list.id);

    const result = await uploadTaskAttachmentForUser("u-viewer-6", task.id, {
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(result.status).toBe("forbidden");
    expect(await listAttachmentsForTask(task.id)).toEqual([]);
  });

  it("returns not_found instead of leaking the existence of a stranger's task", async () => {
    const list = await createList("u-owner-7", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await uploadTaskAttachmentForUser("u-stranger-7", task.id, {
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for an unknown task id", async () => {
    const result = await uploadTaskAttachmentForUser("u-anyone-8", "does-not-exist", {
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for a soft-deleted task, even for its owner", async () => {
    const list = await createList("u-owner-9", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const result = await uploadTaskAttachmentForUser("u-owner-9", task.id, {
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(result.status).toBe("not_found");
  });

  it("returns empty_file for a zero-byte file, without creating a record", async () => {
    const list = await createList("u-owner-10", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await uploadTaskAttachmentForUser("u-owner-10", task.id, {
      filename: "empty.txt",
      mimeType: "text/plain",
      bytes: bytes([]),
    });

    expect(result.status).toBe("empty_file");
    expect(await listAttachmentsForTask(task.id)).toEqual([]);
  });

  it("returns too_large for a file over the size limit, without creating a record", async () => {
    const list = await createList("u-owner-11", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await uploadTaskAttachmentForUser("u-owner-11", task.id, {
      filename: "huge.bin",
      mimeType: "application/octet-stream",
      bytes: new Uint8Array(MAX_ATTACHMENT_SIZE_BYTES + 1),
    });

    expect(result.status).toBe("too_large");
    expect(await listAttachmentsForTask(task.id)).toEqual([]);
  });

  it("accepts a file exactly at the size limit", async () => {
    const list = await createList("u-owner-12", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await uploadTaskAttachmentForUser("u-owner-12", task.id, {
      filename: "exact.bin",
      mimeType: "application/octet-stream",
      bytes: new Uint8Array(MAX_ATTACHMENT_SIZE_BYTES),
    });

    expect(result.status).toBe("ok");
  });
});

describe("uploadTaskAttachmentForUser activity logging", () => {
  it("records an attachment_added activity for the uploading user after a successful upload", async () => {
    const list = await createList("u-owner-20", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const result = await uploadTaskAttachmentForUser("u-owner-20", task.id, {
      filename: "report.pdf",
      mimeType: "application/pdf",
      bytes: bytes([1, 2, 3]),
    });

    expect(result.status).toBe("ok");
    const activity = await listActivityForTask(task.id);
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      entityType: "task",
      entityId: task.id,
      action: "attachment_added",
      byUserId: "u-owner-20",
    });
    if (result.status === "ok") {
      expect(activity[0].metadata).toMatchObject({
        attachmentId: result.attachment.id,
        filename: "report.pdf",
      });
    }
  });

  it("does not record activity when the upload is forbidden (shared read-only access)", async () => {
    const list = await createList("u-owner-21", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u-viewer-21", access: "read" });
    const task = await makeTaskIn(list.id);

    await uploadTaskAttachmentForUser("u-viewer-21", task.id, {
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(await listActivityForTask(task.id)).toEqual([]);
  });

  it("does not record activity when the upload is rejected as an empty file", async () => {
    const list = await createList("u-owner-22", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    await uploadTaskAttachmentForUser("u-owner-22", task.id, {
      filename: "empty.txt",
      mimeType: "text/plain",
      bytes: bytes([]),
    });

    expect(await listActivityForTask(task.id)).toEqual([]);
  });

  it("does not record activity when the target task does not exist", async () => {
    await uploadTaskAttachmentForUser("u-anyone-23", "does-not-exist", {
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(await listActivityForTask("does-not-exist")).toEqual([]);
  });
});
