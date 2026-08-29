import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/tasks/[id]/restore/route";
import { GET } from "@/app/api/tasks/[id]/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, findTaskById, insertTasks } from "@/entities/task/repository";

function restoreRequest(id: string, sessionId: string | undefined) {
  return new NextRequest(`http://localhost/api/tasks/${id}/restore`, {
    method: "POST",
    headers: {
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
  });
}

function callRestore(id: string, request: NextRequest) {
  return POST(request, { params: Promise.resolve({ id }) });
}

function getRequest(id: string, sessionId: string | undefined) {
  return new NextRequest(`http://localhost/api/tasks/${id}`, {
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

function callGet(id: string, request: NextRequest) {
  return GET(request, { params: Promise.resolve({ id }) });
}

// The seed data only defines users u1/u2/u3 (see data.json) — requireAuth
// resolves a session to a real user, so tests must reuse those ids rather
// than inventing arbitrary owner ids.
function sessionFor(userId: "u1" | "u2" | "u3", suffix: string) {
  return createSession({
    userId,
    ip: `192.0.2.${suffix} (demo)`,
    device: "Chrome on Windows",
    rememberMe: false,
  });
}

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

describe("POST /api/tasks/[id]/restore", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callRestore(task.id, restoreRequest(task.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown task id", async () => {
    const session = sessionFor("u1", "220");

    const response = await callRestore("does-not-exist", restoreRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 (not a leaking 403) for a stranger with no access at all", async () => {
    const stranger = sessionFor("u2", "221");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: new Date().toISOString() }]);

    const response = await callRestore(task.id, restoreRequest(task.id, stranger.id));

    expect(response.status).toBe(404);
  });

  it("returns 403 for an edit-access shared user", async () => {
    const editor = sessionFor("u2", "222");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "edit" });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: new Date().toISOString() }]);

    const response = await callRestore(task.id, restoreRequest(task.id, editor.id));

    expect(response.status).toBe(403);
  });

  it("returns 200 and clears deletedAt for the owner within the restore window", async () => {
    const session = sessionFor("u1", "223");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: new Date().toISOString() }]);

    const response = await callRestore(task.id, restoreRequest(task.id, session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.deletedAt).toBeNull();
  });

  it("returns 409 when the restore window has expired", async () => {
    const session = sessionFor("u1", "224");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    const expired = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    insertTasks([{ ...task, deletedAt: expired }]);

    const response = await callRestore(task.id, restoreRequest(task.id, session.id));

    expect(response.status).toBe(409);
    expect(findTaskById(task.id)!.deletedAt).toBe(expired);
  });

  it("is idempotent (200) when restoring a task that is not deleted", async () => {
    const session = sessionFor("u1", "225");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callRestore(task.id, restoreRequest(task.id, session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.deletedAt).toBeNull();
  });

  it("records a history entry describing the restoration", async () => {
    const session = sessionFor("u1", "226");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    const deletedAt = new Date().toISOString();
    insertTasks([{ ...task, deletedAt }]);

    const response = await callRestore(task.id, restoreRequest(task.id, session.id));

    const json = await response.json();
    expect(json.data.history).toHaveLength(1);
    expect(json.data.history[0]).toMatchObject({ field: "deletedAt", old: deletedAt, new: null });
  });

  it("makes the task visible again via GET after restore", async () => {
    const session = sessionFor("u1", "227");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: new Date().toISOString() }]);

    const beforeGet = await callGet(task.id, getRequest(task.id, session.id));
    expect(beforeGet.status).toBe(404);

    await callRestore(task.id, restoreRequest(task.id, session.id));

    const afterGet = await callGet(task.id, getRequest(task.id, session.id));
    expect(afterGet.status).toBe(200);
  });

  it("does not make the task visible when the parent list is deleted", async () => {
    const session = sessionFor("u1", "228");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: new Date().toISOString() }]);
    findListById(list.id)!.deletedAt = new Date().toISOString();

    const response = await callRestore(task.id, restoreRequest(task.id, session.id));

    expect(response.status).toBe(404);
    expect(findTaskById(task.id)!.deletedAt).not.toBeNull();
  });
});
