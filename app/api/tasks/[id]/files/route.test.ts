import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/tasks/[id]/files/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks } from "@/entities/task/repository";
import { createAttachment, listAttachmentsForTask } from "@/entities/attachment/repository";
import { MAX_ATTACHMENT_SIZE_BYTES } from "@/entities/attachment/model";

function filesRequest(taskId: string, sessionId: string | undefined) {
  return new NextRequest(`http://localhost/api/tasks/${taskId}/files`, {
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

// The multipart body is hand-built as raw bytes (rather than handed a
// FormData/File object) so the test exercises exactly the wire format a real
// browser upload sends. Building it via the platform FormData/File globals
// instead round-trips through vitest's jsdom environment, whose File class
// is a different realm than the one NextRequest#formData() reconstructs
// internally — that mismatch silently drops the filename.
const BOUNDARY = "----vitest-boundary-attachment";

interface MultipartField {
  name: string;
  filename?: string;
  mimeType?: string;
  content: string | Uint8Array;
}

function multipartBody(fields: MultipartField[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  for (const field of fields) {
    const disposition =
      field.filename !== undefined
        ? `Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\n`
        : `Content-Disposition: form-data; name="${field.name}"\r\n`;
    const contentType = field.mimeType !== undefined ? `Content-Type: ${field.mimeType}\r\n` : "";
    parts.push(encoder.encode(`--${BOUNDARY}\r\n${disposition}${contentType}\r\n`));
    parts.push(typeof field.content === "string" ? encoder.encode(field.content) : field.content);
    parts.push(encoder.encode("\r\n"));
  }
  parts.push(encoder.encode(`--${BOUNDARY}--\r\n`));

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }
  return body;
}

function fileMultipart(filename: string, content: string | Uint8Array, mimeType = "text/plain"): Uint8Array {
  return multipartBody([{ name: "file", filename, mimeType, content }]);
}

function uploadRequest(taskId: string, sessionId: string | undefined, body: Uint8Array) {
  return new NextRequest(`http://localhost/api/tasks/${taskId}/files`, {
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: body as BodyInit,
  });
}

function malformedUploadRequest(taskId: string, sessionId: string) {
  return new NextRequest(`http://localhost/api/tasks/${taskId}/files`, {
    method: "POST",
    headers: {
      "content-type": "multipart/form-data; boundary=----broken",
      cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
    },
    body: "this is not valid multipart data",
  });
}

async function callGet(taskId: string, request: NextRequest) {
  return await GET(request, { params: Promise.resolve({ id: taskId }) });
}

async function callPost(taskId: string, request: NextRequest) {
  return await POST(request, { params: Promise.resolve({ id: taskId }) });
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

describe("GET /api/tasks/[id]/files", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callGet(task.id, filesRequest(task.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 200 with the task's attachments for its owner", async () => {
    const session = await sessionFor("u1", "400");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const attachment = await createAttachment({
      taskId: task.id,
      uploadedBy: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      bytes: new Uint8Array([1]),
    });

    const response = await callGet(task.id, filesRequest(task.id, session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe(attachment.id);
    expect(json.data[0].uploaderEmail).toBe("admin@example.com");
  });

  it("returns 404 for an unknown task id", async () => {
    const session = await sessionFor("u1", "401");

    const response = await callGet("does-not-exist", filesRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a task inaccessible to the user (not a leaking 403)", async () => {
    const session = await sessionFor("u2", "402");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callGet(task.id, filesRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a soft-deleted task", async () => {
    const session = await sessionFor("u1", "403");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const response = await callGet(task.id, filesRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });
});

describe("POST /api/tasks/[id]/files", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, uploadRequest(task.id, undefined, fileMultipart("a.txt", "hello")));

    expect(response.status).toBe(401);
  });

  it("uploads a file for the task's owner and returns 201", async () => {
    const session = await sessionFor("u1", "410");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(
      task.id,
      uploadRequest(task.id, session.id, fileMultipart("report.pdf", "%PDF-1.4 fake", "application/pdf")),
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.filename).toBe("report.pdf");
    expect(json.data.mimeType).toBe("application/pdf");
    expect(json.data.uploadedBy).toBe("u1");
    expect(await listAttachmentsForTask(task.id)).toHaveLength(1);
  });

  it("preserves a Unicode filename with spaces", async () => {
    const session = await sessionFor("u1", "411");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(
      task.id,
      uploadRequest(task.id, session.id, fileMultipart("Отчёт по задаче №1.txt", "hello")),
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.filename).toBe("Отчёт по задаче №1.txt");
  });

  it("does not treat a path-traversal-shaped filename as a filesystem path (stores it as plain metadata)", async () => {
    const session = await sessionFor("u1", "412");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(
      task.id,
      uploadRequest(task.id, session.id, fileMultipart("../../../../etc/passwd", "hello")),
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.filename).toBe("../../../../etc/passwd");
  });

  it("allows duplicate filenames on the same task", async () => {
    const session = await sessionFor("u1", "413");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    await callPost(task.id, uploadRequest(task.id, session.id, fileMultipart("same.txt", "one")));
    const response = await callPost(task.id, uploadRequest(task.id, session.id, fileMultipart("same.txt", "two")));

    expect(response.status).toBe(201);
    expect(await listAttachmentsForTask(task.id)).toHaveLength(2);
  });

  it("accepts a file with no MIME allowlist restriction", async () => {
    const session = await sessionFor("u1", "414");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(
      task.id,
      uploadRequest(task.id, session.id, fileMultipart("app.exe", "binary", "application/x-msdownload")),
    );

    expect(response.status).toBe(201);
  });

  it("returns 400 for an empty file, without creating a record", async () => {
    const session = await sessionFor("u1", "415");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, uploadRequest(task.id, session.id, fileMultipart("empty.txt", "")));

    expect(response.status).toBe(400);
    expect(await listAttachmentsForTask(task.id)).toEqual([]);
  });

  it("returns 413 for a file over the size limit, without creating a record", async () => {
    const session = await sessionFor("u1", "416");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(
      task.id,
      uploadRequest(task.id, session.id, fileMultipart("huge.bin", new Uint8Array(MAX_ATTACHMENT_SIZE_BYTES + 1))),
    );

    expect(response.status).toBe(413);
    expect(await listAttachmentsForTask(task.id)).toEqual([]);
  });

  it("returns 400 for a request with no file field", async () => {
    const session = await sessionFor("u1", "417");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, uploadRequest(task.id, session.id, multipartBody([])));

    expect(response.status).toBe(400);
  });

  it("returns 400 for malformed multipart data", async () => {
    const session = await sessionFor("u1", "418");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, malformedUploadRequest(task.id, session.id));

    expect(response.status).toBe(400);
  });

  it("returns 403 for a read-only shared user, without creating a record (IDOR-adjacent: edit-only action gated by view-only access)", async () => {
    const session = await sessionFor("u2", "419");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, uploadRequest(task.id, session.id, fileMultipart("a.txt", "hi")));

    expect(response.status).toBe(403);
    expect(await listAttachmentsForTask(task.id)).toEqual([]);
  });

  it("returns 404 for a task inaccessible to the user (not a leaking 403)", async () => {
    const session = await sessionFor("u2", "420");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, uploadRequest(task.id, session.id, fileMultipart("a.txt", "hi")));

    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown task id", async () => {
    const session = await sessionFor("u1", "421");

    const response = await callPost(
      "does-not-exist",
      uploadRequest("does-not-exist", session.id, fileMultipart("a.txt", "hi")),
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for a soft-deleted task", async () => {
    const session = await sessionFor("u1", "422");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const response = await callPost(task.id, uploadRequest(task.id, session.id, fileMultipart("a.txt", "hi")));

    expect(response.status).toBe(404);
  });

  it("ignores client-supplied server-owned fields and always attributes the upload to the authenticated user", async () => {
    const session = await sessionFor("u2", "423");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "edit" });
    const task = await makeTaskIn(list.id);

    const body = multipartBody([
      { name: "file", filename: "a.txt", mimeType: "text/plain", content: "hi" },
      { name: "uploadedBy", content: "u1" },
      { name: "userId", content: "u1" },
    ]);

    const response = await callPost(task.id, uploadRequest(task.id, session.id, body));

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.uploadedBy).toBe("u2");
  });
});
