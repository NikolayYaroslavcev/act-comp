import { describe, expect, it } from "vitest";
import { downloadTaskAttachmentForUser } from "@/features/attachment/download-task-attachment";
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

describe("downloadTaskAttachmentForUser", () => {
  it("returns the exact bytes, filename, and mime type for the task's owner", () => {
    const list = createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    const attachment = createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-1",
      filename: "report.pdf",
      mimeType: "application/pdf",
      bytes: bytes([1, 2, 3, 4]),
    });

    const result = downloadTaskAttachmentForUser("u-owner-1", task.id, attachment.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.bytes).toEqual(bytes([1, 2, 3, 4]));
      expect(result.attachment.filename).toBe("report.pdf");
      expect(result.attachment.mimeType).toBe("application/pdf");
    }
  });

  it("preserves a Unicode filename", () => {
    const list = createList("u-owner-2", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    const attachment = createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-2",
      filename: "Отчёт.pdf",
      mimeType: "application/pdf",
      bytes: bytes([1]),
    });

    const result = downloadTaskAttachmentForUser("u-owner-2", task.id, attachment.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.attachment.filename).toBe("Отчёт.pdf");
    }
  });

  it("allows a shared read-only user to download", () => {
    const list = createList("u-owner-3", { title: "Shared", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u-viewer-3", access: "read" });
    const task = makeTaskIn(list.id);
    const attachment = createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-3",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(downloadTaskAttachmentForUser("u-viewer-3", task.id, attachment.id).status).toBe("ok");
  });

  it("returns not_found for a stranger's task, without leaking existence", () => {
    const list = createList("u-owner-4", { title: "Private", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    const attachment = createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-4",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(downloadTaskAttachmentForUser("u-stranger-4", task.id, attachment.id).status).toBe("not_found");
  });

  it("returns not_found for an unknown attachment id", () => {
    const list = createList("u-owner-5", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    expect(downloadTaskAttachmentForUser("u-owner-5", task.id, "does-not-exist").status).toBe("not_found");
  });

  it("returns not_found when the attachment belongs to a different task than the one in the URL (no IDOR via mismatched ids)", () => {
    const list = createList("u-owner-6", { title: "Owned", template: "work", deadline: null });
    const taskA = makeTaskIn(list.id);
    const taskB = makeTaskIn(list.id);
    const attachment = createAttachment({
      taskId: taskA.id,
      uploadedBy: "u-owner-6",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    const result = downloadTaskAttachmentForUser("u-owner-6", taskB.id, attachment.id);

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for an unknown task id", () => {
    expect(downloadTaskAttachmentForUser("u-anyone-7", "does-not-exist", "also-missing").status).toBe(
      "not_found",
    );
  });

  it("returns not_found for a soft-deleted task, even for its owner", () => {
    const list = createList("u-owner-8", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    const attachment = createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-8",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    expect(downloadTaskAttachmentForUser("u-owner-8", task.id, attachment.id).status).toBe("not_found");
  });
});
