import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/tasks/[id]/comments/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks } from "@/entities/task/repository";
import { createComment, listCommentsForTask } from "@/entities/comment/repository";

function commentsRequest(taskId: string, sessionId: string | undefined) {
  return new NextRequest(`http://localhost/api/tasks/${taskId}/comments`, {
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

function createCommentRequest(taskId: string, sessionId: string | undefined, body: unknown) {
  return new NextRequest(`http://localhost/api/tasks/${taskId}/comments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function createCommentRequestWithRawBody(taskId: string, sessionId: string, rawBody: string) {
  return new NextRequest(`http://localhost/api/tasks/${taskId}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${sessionId}` },
    body: rawBody,
  });
}

async function callGet(taskId: string, request: NextRequest) {
  return await GET(request, { params: Promise.resolve({ id: taskId }) });
}

async function callPost(taskId: string, request: NextRequest) {
  return await POST(request, { params: Promise.resolve({ id: taskId }) });
}

// The seed data only defines users u1/u2/u3 (see data.json) — requireAuth
// resolves a session to a real user, so tests must reuse those ids rather
// than inventing arbitrary owner ids.
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

describe("GET /api/tasks/[id]/comments", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callGet(task.id, commentsRequest(task.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 200 with the task's comments for its owner", async () => {
    const session = await sessionFor("u1", "300");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    const comment = await createComment({ taskId: task.id, authorId: "u1", text: "Hello" });

    const response = await callGet(task.id, commentsRequest(task.id, session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe(comment.id);
    expect(json.data[0].authorEmail).toBe("admin@example.com");
  });

  it("returns 404 for an unknown task id", async () => {
    const session = await sessionFor("u1", "301");

    const response = await callGet("does-not-exist", commentsRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a task inaccessible to the user (not a leaking 403)", async () => {
    const session = await sessionFor("u2", "302");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callGet(task.id, commentsRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });
});

describe("POST /api/tasks/[id]/comments", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, createCommentRequest(task.id, undefined, { text: "Hi" }));

    expect(response.status).toBe(401);
  });

  it("creates a comment for the task's owner and returns 201", async () => {
    const session = await sessionFor("u1", "310");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, createCommentRequest(task.id, session.id, { text: "Hello" }));

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.text).toBe("Hello");
    expect(json.data.authorId).toBe("u1");
    expect(json.data.taskId).toBe(task.id);
    expect(await listCommentsForTask(task.id)).toHaveLength(1);
  });

  it("returns 403 for a read-only shared user, without creating a comment", async () => {
    const session = await sessionFor("u2", "311");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, createCommentRequest(task.id, session.id, { text: "Hi" }));

    expect(response.status).toBe(403);
    expect(await listCommentsForTask(task.id)).toEqual([]);
  });

  it("returns 404 for an unknown task id", async () => {
    const session = await sessionFor("u1", "312");

    const response = await callPost(
      "does-not-exist",
      createCommentRequest("does-not-exist", session.id, { text: "Hi" }),
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid JSON", async () => {
    const session = await sessionFor("u1", "313");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, createCommentRequestWithRawBody(task.id, session.id, "{ not json"));

    expect(response.status).toBe(400);
  });

  it("returns 400 for an empty text", async () => {
    const session = await sessionFor("u1", "314");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, createCommentRequest(task.id, session.id, { text: "" }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.issues).toBeTruthy();
  });

  it("returns 400 for a missing text field", async () => {
    const session = await sessionFor("u1", "315");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, createCommentRequest(task.id, session.id, {}));

    expect(response.status).toBe(400);
  });

  it("ignores client-supplied server-owned fields (authorId, taskId, id, createdAt)", async () => {
    const session = await sessionFor("u2", "316");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "edit" });
    const task = await makeTaskIn(list.id);
    const otherTask = await makeTaskIn(list.id);

    const response = await callPost(
      task.id,
      createCommentRequest(task.id, session.id, {
        text: "Hello",
        authorId: "u1",
        taskId: otherTask.id,
        id: "spoofed-id",
        createdAt: "2020-01-01T00:00:00.000Z",
      }),
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.authorId).toBe("u2");
    expect(json.data.taskId).toBe(task.id);
    expect(json.data.id).not.toBe("spoofed-id");
    expect(json.data.createdAt).not.toBe("2020-01-01T00:00:00.000Z");
  });

  it("returns 404 for a task whose list is inaccessible to the user (not a leaking 403)", async () => {
    const session = await sessionFor("u2", "317");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callPost(task.id, createCommentRequest(task.id, session.id, { text: "Hi" }));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a soft-deleted task", async () => {
    const session = await sessionFor("u1", "318");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const response = await callPost(task.id, createCommentRequest(task.id, session.id, { text: "Hi" }));

    expect(response.status).toBe(404);
  });
});
