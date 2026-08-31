import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/tasks/[id]/changes/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession, revokeSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks, updateTask } from "@/entities/task/repository";

function changesRequest(taskId: string, sessionId: string | undefined, since = "2026-08-30T09:00:00.000Z") {
  return new NextRequest(`http://localhost/api/tasks/${taskId}/changes?since=${encodeURIComponent(since)}`, {
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

function callGet(taskId: string, request: NextRequest) {
  return GET(request, { params: Promise.resolve({ id: taskId }) });
}

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

const T1 = "2026-08-30T10:00:00.000Z";

describe("GET /api/tasks/[id]/changes", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callGet(task.id, changesRequest(task.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 401 for a revoked session", async () => {
    const session = sessionFor("u1", "600");
    revokeSession(session.id);
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callGet(task.id, changesRequest(task.id, session.id));

    expect(response.status).toBe(401);
  });

  it("returns 400 for a missing or malformed `since` parameter", async () => {
    const session = sessionFor("u1", "601");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    expect((await callGet(task.id, changesRequest(task.id, session.id, ""))).status).toBe(400);
    const noSince = new NextRequest(`http://localhost/api/tasks/${task.id}/changes`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${session.id}` },
    });
    expect((await callGet(task.id, noSince)).status).toBe(400);
  });

  it("returns changed:true for the owner when another shared-edit user changed the task", async () => {
    const owner = sessionFor("u1", "602");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u3", access: "edit" });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u3", { priority: 5 }, new Date(T1));

    const response = await callGet(task.id, changesRequest(task.id, owner.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.changed).toBe(true);
    expect(json.data.actorUserId).toBe("u3");
    expect(json.data.taskId).toBe(task.id);
    expect(json.data.listId).toBe(list.id);
  });

  it("does not report the requesting user's own change", async () => {
    const session = sessionFor("u1", "603");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    updateTask(task.id, "u1", { priority: 5 }, new Date(T1));

    const response = await callGet(task.id, changesRequest(task.id, session.id));

    const json = await response.json();
    expect(json.data.changed).toBe(false);
  });

  it("returns 404 for another user's private task", async () => {
    const session = sessionFor("u2", "604");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callGet(task.id, changesRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a soft-deleted task", async () => {
    const session = sessionFor("u1", "605");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-31T00:00:00.000Z" }]);

    const response = await callGet(task.id, changesRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown task", async () => {
    const session = sessionFor("u1", "606");

    const response = await callGet("does-not-exist", changesRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("ignores a spoofed userId query parameter and uses the session user", async () => {
    const session = sessionFor("u2", "607");
    const list = createList("u1", { title: "Private", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const request = new NextRequest(
      `http://localhost/api/tasks/${task.id}/changes?since=2026-08-30T09:00:00.000Z&userId=u1`,
      { headers: { cookie: `${SESSION_COOKIE_NAME}=${session.id}` } },
    );

    expect((await callGet(task.id, request)).status).toBe(404);
  });
});
