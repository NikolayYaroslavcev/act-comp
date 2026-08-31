import { describe, expect, it } from "vitest";
import {
  createAttachment,
  deleteAttachment,
  findAttachmentById,
  listAttachmentsForTask,
  readAttachmentBytes,
} from "@/entities/attachment/repository";
import { getDb } from "@/shared/lib/db";

function bytes(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe("createAttachment", () => {
  it("persists metadata with a generated id and the given fields", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const attachment = await createAttachment({
      taskId,
      uploadedBy: "u1",
      filename: "report.pdf",
      mimeType: "application/pdf",
      bytes: bytes([1, 2, 3]),
    });

    expect(attachment.id).toBeTruthy();
    expect(attachment.taskId).toBe(taskId);
    expect(attachment.filename).toBe("report.pdf");
    expect(attachment.mimeType).toBe("application/pdf");
    expect(attachment.uploadedBy).toBe("u1");
    expect(attachment.size).toBe(3);
  });

  it("stamps uploadedAt from the given now", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const now = new Date("2026-08-20T10:00:00.000Z");

    const attachment = await createAttachment(
      { taskId, uploadedBy: "u1", filename: "a.txt", mimeType: "text/plain", bytes: bytes([1]) },
      now,
    );

    expect(attachment.uploadedAt).toBe("2026-08-20T10:00:00.000Z");
  });

  it("stores the metadata directly in the shared db under its id", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const attachment = await createAttachment({
      taskId,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect((await getDb()).attachments[attachment.id]).toEqual(attachment);
  });

  it("makes the uploaded bytes readable back via readAttachmentBytes", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const attachment = await createAttachment({
      taskId,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([9, 8, 7]),
    });

    expect(await readAttachmentBytes(attachment)).toEqual(bytes([9, 8, 7]));
  });

  it("preserves a Unicode filename verbatim", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const attachment = await createAttachment({
      taskId,
      uploadedBy: "u1",
      filename: "Отчёт по задаче.pdf",
      mimeType: "application/pdf",
      bytes: bytes([1]),
    });

    expect(attachment.filename).toBe("Отчёт по задаче.pdf");
  });

  it("strips control characters from the stored filename", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const attachment = await createAttachment({
      taskId,
      uploadedBy: "u1",
      filename: "evil\r\n\0name.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(attachment.filename).toBe("evilname.txt");
  });

  it("caps an extremely long filename", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const attachment = await createAttachment({
      taskId,
      uploadedBy: "u1",
      filename: `${"a".repeat(400)}.txt`,
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(attachment.filename.length).toBeLessThanOrEqual(255);
  });
});

describe("listAttachmentsForTask", () => {
  it("returns only attachments belonging to the given task", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const otherTaskId = `task-${crypto.randomUUID()}`;
    const own = await createAttachment({
      taskId,
      uploadedBy: "u1",
      filename: "mine.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });
    await createAttachment({
      taskId: otherTaskId,
      uploadedBy: "u1",
      filename: "not-mine.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(await listAttachmentsForTask(taskId)).toEqual([own]);
  });

  it("returns an empty array for a task with no attachments", async () => {
    expect(await listAttachmentsForTask(`task-${crypto.randomUUID()}`)).toEqual([]);
  });

  it("orders attachments oldest to newest regardless of insertion order", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const newer = await createAttachment(
      { taskId, uploadedBy: "u1", filename: "newer.txt", mimeType: "text/plain", bytes: bytes([1]) },
      new Date("2026-08-20T12:00:00.000Z"),
    );
    const older = await createAttachment(
      { taskId, uploadedBy: "u1", filename: "older.txt", mimeType: "text/plain", bytes: bytes([1]) },
      new Date("2026-08-20T08:00:00.000Z"),
    );

    expect((await listAttachmentsForTask(taskId)).map((a) => a.id)).toEqual([older.id, newer.id]);
  });
});

describe("findAttachmentById", () => {
  it("finds a previously created attachment", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const attachment = await createAttachment({
      taskId,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(await findAttachmentById(attachment.id)).toEqual(attachment);
  });

  it("returns undefined for an unknown id", async () => {
    expect(await findAttachmentById("does-not-exist")).toBeUndefined();
  });
});

describe("deleteAttachment", () => {
  it("removes the metadata record", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const attachment = await createAttachment({
      taskId,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    await deleteAttachment(attachment.id);

    expect(await findAttachmentById(attachment.id)).toBeUndefined();
  });

  it("removes the underlying bytes, leaving no orphan blob", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const attachment = await createAttachment({
      taskId,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1, 2, 3]),
    });

    await deleteAttachment(attachment.id);

    expect(await readAttachmentBytes(attachment)).toBeUndefined();
  });

  it("returns the deleted attachment", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const attachment = await createAttachment({
      taskId,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(await deleteAttachment(attachment.id)).toEqual(attachment);
  });

  it("returns undefined and does not throw for an unknown id (repeated delete is safe)", async () => {
    expect(await deleteAttachment("does-not-exist")).toBeUndefined();
  });

  it("is safe to call twice in a row on the same attachment", async () => {
    const taskId = `task-${crypto.randomUUID()}`;
    const attachment = await createAttachment({
      taskId,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: bytes([1]),
    });

    expect(await deleteAttachment(attachment.id)).toEqual(attachment);
    expect(await deleteAttachment(attachment.id)).toBeUndefined();
  });
});
