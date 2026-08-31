import { describe, expect, it } from "vitest";
import { downloadTaskAttachmentForUser } from "@/features/attachment/download-task-attachment";
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

describe("downloadTaskAttachmentForUser", () => {
  it("returns the exact bytes, filename, and mime type for the task's owner", async () => {
    const list = await createList("u-owner-1", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-1",
      filename: "report.pdf",
      mimeType: "application/pdf",
      bytes: bytes([1, 2, 3, 4]),
    });

    const result = await downloadTaskAttachmentForUser("u-owner-1", task.id, attachment.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.bytes).toEqual(bytes([1, 2, 3, 4]));
      expect(result.attachment.filename).toBe("report.pdf");
      expect(result.attachment.mimeType).toBe("application/pdf");
    }
  });

  it("preserves a Unicode filename", async () => {
    const list = await createList("u-owner-2", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-2",
      filename: "Отчёт.pdf",
      mimeType: "application/pdf",
      bytes: bytes([1]),
    });

    const result = await downloadTaskAttachmentForUser("u-owner-2", task.id, attachment.id);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.attachment.filename).toBe("Отчёт.pdf");
    }
  });

  it("allows a shared read-only user to download", async () => {
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

    expect((await downloadTaskAttachmentForUser("u-viewer-3", task.id, attachment.id)).status).toBe("ok");
  });

  it("returns not_found for a stranger's task, without leaking existence", async () => {
    const list = await createList("u-owner-4", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-4",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect((await downloadTaskAttachmentForUser("u-stranger-4", task.id, attachment.id)).status).toBe("not_found");
  });

  it("returns not_found for an unknown attachment id", async () => {
    const list = await createList("u-owner-5", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    expect((await downloadTaskAttachmentForUser("u-owner-5", task.id, "does-not-exist")).status).toBe("not_found");
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

    const result = await downloadTaskAttachmentForUser("u-owner-6", taskB.id, attachment.id);

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for an unknown task id", async () => {
    expect((await downloadTaskAttachmentForUser("u-anyone-7", "does-not-exist", "also-missing")).status).toBe(
      "not_found",
    );
  });

  it("returns not_found for a soft-deleted task, even for its owner", async () => {
    const list = await createList("u-owner-8", { title: "Owned", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u-owner-8",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    expect((await downloadTaskAttachmentForUser("u-owner-8", task.id, attachment.id)).status).toBe("not_found");
  });
});
