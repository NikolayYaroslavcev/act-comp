import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET } from "@/app/api/tasks/[id]/files/[fileId]/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks } from "@/entities/task/repository";
import { createAttachment, findAttachmentById } from "@/entities/attachment/repository";

function fileRequest(taskId: string, fileId: string, sessionId: string | undefined, method = "GET") {
  return new NextRequest(`http://localhost/api/tasks/${taskId}/files/${fileId}`, {
    method,
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

async function callGet(taskId: string, fileId: string, request: NextRequest) {
  return await GET(request, { params: Promise.resolve({ id: taskId, fileId }) });
}

async function callDelete(taskId: string, fileId: string, request: NextRequest) {
  return await DELETE(request, { params: Promise.resolve({ id: taskId, fileId }) });
}

async function sessionFor(userId: "u1" | "u2" | "u3", suffix: string) {
  return await createSession({
    userId,
    ip: `192.0.2.${suffix} (demo)`,
    device: "Chrome on Windows",
    rememberMe: false,
  });
}

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

describe("GET /api/tasks/[id]/files/[fileId]", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const response = await callGet(task.id, attachment.id, fileRequest(task.id, attachment.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns the exact bytes with the correct content type and filename for the owner", async () => {
    const session = await sessionFor("u1", "500");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "report.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array([37, 80, 68, 70]),
    });

    const response = await callGet(task.id, attachment.id, fileRequest(task.id, attachment.id, session.id));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("content-disposition")).toContain("report.pdf");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes).toEqual(new Uint8Array([37, 80, 68, 70]));
  });

  it("downloads HTML/SVG as an attachment with a generic content type", async () => {
    const session = await sessionFor("u1", "500b");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "xss.svg",
      mimeType: "image/svg+xml",
      bytes: new Uint8Array([60, 115, 118, 103]),
    });

    const response = await callGet(task.id, attachment.id, fileRequest(task.id, attachment.id, session.id));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect((await findAttachmentById(attachment.id))?.mimeType).toBe("image/svg+xml");
  });

  it("percent-encodes a Unicode filename in Content-Disposition and decodes back to the original", async () => {
    const session = await sessionFor("u1", "501");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "Отчёт по задаче.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array([1]),
    });

    const response = await callGet(task.id, attachment.id, fileRequest(task.id, attachment.id, session.id));

    const disposition = response.headers.get("content-disposition")!;
    const match = /filename\*=UTF-8''(.+)$/.exec(disposition);
    expect(match).not.toBeNull();
    expect(decodeURIComponent(match![1])).toBe("Отчёт по задаче.pdf");
  });

  it("allows a shared read-only user to download", async () => {
    const session = await sessionFor("u2", "502");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const response = await callGet(task.id, attachment.id, fileRequest(task.id, attachment.id, session.id));

    expect(response.status).toBe(200);
  });

  it("returns 404 for a task inaccessible to the user (not a leaking 403)", async () => {
    const session = await sessionFor("u2", "503");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const response = await callGet(task.id, attachment.id, fileRequest(task.id, attachment.id, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown file id", async () => {
    const session = await sessionFor("u1", "504");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callGet(task.id, "does-not-exist", fileRequest(task.id, "does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a path-traversal-shaped file id instead of reading any file (no traversal)", async () => {
    const session = await sessionFor("u1", "505");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const traversalId = "../../../../etc/passwd";

    const response = await callGet(task.id, traversalId, fileRequest(task.id, traversalId, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 when the file id belongs to a different task than the one in the URL (no IDOR via mismatched ids)", async () => {
    const session = await sessionFor("u1", "506");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const taskA = await makeTaskIn(list.id);
    const taskB = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: taskA.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const response = await callGet(taskB.id, attachment.id, fileRequest(taskB.id, attachment.id, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a file that belongs to another user's inaccessible task, even with a valid file id", async () => {
    const session = await sessionFor("u2", "507");
    const list = await createList("u1", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "secret.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const response = await callGet(task.id, attachment.id, fileRequest(task.id, attachment.id, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a soft-deleted task", async () => {
    const session = await sessionFor("u1", "508");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const response = await callGet(task.id, attachment.id, fileRequest(task.id, attachment.id, session.id));

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/tasks/[id]/files/[fileId]", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const response = await callDelete(
      task.id,
      attachment.id,
      fileRequest(task.id, attachment.id, undefined, "DELETE"),
    );

    expect(response.status).toBe(401);
  });

  it("deletes the file for the owner and returns 204", async () => {
    const session = await sessionFor("u1", "510");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const response = await callDelete(
      task.id,
      attachment.id,
      fileRequest(task.id, attachment.id, session.id, "DELETE"),
    );

    expect(response.status).toBe(204);
    expect(await findAttachmentById(attachment.id)).toBeUndefined();
  });

  it("allows a shared editor to delete", async () => {
    const session = await sessionFor("u2", "511");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "edit" });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const response = await callDelete(
      task.id,
      attachment.id,
      fileRequest(task.id, attachment.id, session.id, "DELETE"),
    );

    expect(response.status).toBe(204);
  });

  it("returns 403 for a read-only shared user, without deleting", async () => {
    const session = await sessionFor("u2", "512");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const response = await callDelete(
      task.id,
      attachment.id,
      fileRequest(task.id, attachment.id, session.id, "DELETE"),
    );

    expect(response.status).toBe(403);
    expect(await findAttachmentById(attachment.id)).toBeDefined();
  });

  it("returns 404 for a task inaccessible to the user (not a leaking 403)", async () => {
    const session = await sessionFor("u2", "513");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const response = await callDelete(
      task.id,
      attachment.id,
      fileRequest(task.id, attachment.id, session.id, "DELETE"),
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown file id", async () => {
    const session = await sessionFor("u1", "514");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callDelete(
      task.id,
      "does-not-exist",
      fileRequest(task.id, "does-not-exist", session.id, "DELETE"),
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when the file id belongs to a different task than the one in the URL (no IDOR via mismatched ids)", async () => {
    const session = await sessionFor("u1", "515");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const taskA = await makeTaskIn(list.id);
    const taskB = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: taskA.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const response = await callDelete(
      taskB.id,
      attachment.id,
      fileRequest(taskB.id, attachment.id, session.id, "DELETE"),
    );

    expect(response.status).toBe(404);
    expect(await findAttachmentById(attachment.id)).toBeDefined();
  });

  it("returns 404 for a soft-deleted task", async () => {
    const session = await sessionFor("u1", "516");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const response = await callDelete(
      task.id,
      attachment.id,
      fileRequest(task.id, attachment.id, session.id, "DELETE"),
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 (not a crash) when deleting the same file twice", async () => {
    const session = await sessionFor("u1", "517");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const first = await callDelete(
      task.id,
      attachment.id,
      fileRequest(task.id, attachment.id, session.id, "DELETE"),
    );
    const second = await callDelete(
      task.id,
      attachment.id,
      fileRequest(task.id, attachment.id, session.id, "DELETE"),
    );

    expect(first.status).toBe(204);
    expect(second.status).toBe(404);
  });
});
