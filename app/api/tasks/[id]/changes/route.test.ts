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

async function callGet(taskId: string, request: NextRequest) {
  return await GET(request, { params: Promise.resolve({ id: taskId }) });
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

const T1 = "2026-08-30T10:00:00.000Z";

describe("GET /api/tasks/[id]/changes", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callGet(task.id, changesRequest(task.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 401 for a revoked session", async () => {
    const session = await sessionFor("u1", "600");
    await revokeSession(session.id);
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callGet(task.id, changesRequest(task.id, session.id));

    expect(response.status).toBe(401);
  });

  it("returns 400 for a missing or malformed `since` parameter", async () => {
    const session = await sessionFor("u1", "601");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    expect((await callGet(task.id, changesRequest(task.id, session.id, ""))).status).toBe(400);
    const noSince = new NextRequest(`http://localhost/api/tasks/${task.id}/changes`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${session.id}` },
    });
    expect((await callGet(task.id, noSince)).status).toBe(400);
  });

  it("returns changed:true for the owner when another shared-edit user changed the task", async () => {
    const owner = await sessionFor("u1", "602");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u3", access: "edit" });
    const task = await makeTaskIn(list.id);
    await updateTask(task.id, "u3", { priority: 5 }, new Date(T1));

    const response = await callGet(task.id, changesRequest(task.id, owner.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.changed).toBe(true);
    expect(json.data.actorUserId).toBe("u3");
    expect(json.data.taskId).toBe(task.id);
    expect(json.data.listId).toBe(list.id);
  });

  it("does not report the requesting user's own change", async () => {
    const session = await sessionFor("u1", "603");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await updateTask(task.id, "u1", { priority: 5 }, new Date(T1));

    const response = await callGet(task.id, changesRequest(task.id, session.id));

    const json = await response.json();
    expect(json.data.changed).toBe(false);
  });

  it("returns 404 for another user's private task", async () => {
    const session = await sessionFor("u2", "604");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callGet(task.id, changesRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a soft-deleted task", async () => {
    const session = await sessionFor("u1", "605");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, deletedAt: "2026-08-31T00:00:00.000Z" }]);

    const response = await callGet(task.id, changesRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown task", async () => {
    const session = await sessionFor("u1", "606");

    const response = await callGet("does-not-exist", changesRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("ignores a spoofed userId query parameter and uses the session user", async () => {
    const session = await sessionFor("u2", "607");
    const list = await createList("u1", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const request = new NextRequest(
      `http://localhost/api/tasks/${task.id}/changes?since=2026-08-30T09:00:00.000Z&userId=u1`,
      { headers: { cookie: `${SESSION_COOKIE_NAME}=${session.id}` } },
    );

    expect((await callGet(task.id, request)).status).toBe(404);
  });
});
