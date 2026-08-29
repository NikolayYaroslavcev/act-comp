import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/tasks/[id]/clone/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, findTaskById, insertTasks } from "@/entities/task/repository";

function cloneRequest(id: string, sessionId: string | undefined) {
  return new NextRequest(`http://localhost/api/tasks/${id}/clone`, {
    method: "POST",
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

function callClone(id: string, request: NextRequest) {
  return POST(request, { params: Promise.resolve({ id }) });
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

describe("POST /api/tasks/[id]/clone", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callClone(task.id, cloneRequest(task.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown task id", async () => {
    const session = sessionFor("u1", "300");

    const response = await callClone("does-not-exist", cloneRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 (not a leaking 403) for a stranger with no access at all", async () => {
    const stranger = sessionFor("u2", "301");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callClone(task.id, cloneRequest(task.id, stranger.id));

    expect(response.status).toBe(404);
  });

  it("returns 403 for a shared read-access user, without cloning", async () => {
    const viewer = sessionFor("u2", "302");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });
    const task = makeTaskIn(list.id);

    const response = await callClone(task.id, cloneRequest(task.id, viewer.id));

    expect(response.status).toBe(403);
    expect(findListById(list.id)!.taskIds).toEqual([task.id]);
  });

  it("returns 201 with a new task for the owner", async () => {
    const session = sessionFor("u1", "303");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callClone(task.id, cloneRequest(task.id, session.id));

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.id).not.toBe(task.id);
    expect(json.data.listId).toBe(list.id);
  });

  it("returns 201 for a shared edit-access user", async () => {
    const editor = sessionFor("u2", "304");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "edit" });
    const task = makeTaskIn(list.id);

    const response = await callClone(task.id, cloneRequest(task.id, editor.id));

    expect(response.status).toBe(201);
  });

  it("assigns the clone a different code than the source", async () => {
    const session = sessionFor("u1", "305");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callClone(task.id, cloneRequest(task.id, session.id));

    const json = await response.json();
    expect(json.data.code).not.toBe(task.code);
  });

  it("does not modify the original task", async () => {
    const session = sessionFor("u1", "306");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    const snapshot = { ...findTaskById(task.id)! };

    await callClone(task.id, cloneRequest(task.id, session.id));

    expect(findTaskById(task.id)).toEqual(snapshot);
  });

  it("creates another new task with a different id on a repeated call", async () => {
    const session = sessionFor("u1", "307");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const first = await callClone(task.id, cloneRequest(task.id, session.id));
    const second = await callClone(task.id, cloneRequest(task.id, session.id));

    const firstJson = await first.json();
    const secondJson = await second.json();
    expect(firstJson.data.id).not.toBe(secondJson.data.id);
  });

  it("returns 404 for a soft-deleted source task", async () => {
    const session = sessionFor("u1", "308");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: new Date().toISOString() }]);

    const response = await callClone(task.id, cloneRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 when the parent list is soft-deleted, even for its owner", async () => {
    const session = sessionFor("u1", "309");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    findListById(list.id)!.deletedAt = new Date().toISOString();

    const response = await callClone(task.id, cloneRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });

  it("resets runtime timer state on the clone", async () => {
    const session = sessionFor("u1", "310");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([
      {
        ...findTaskById(task.id)!,
        timeSpentMin: 45,
        timerStartedAt: "2026-08-27T10:00:00.000Z",
      },
    ]);

    const response = await callClone(task.id, cloneRequest(task.id, session.id));

    const json = await response.json();
    expect(json.data.timeSpentMin).toBe(0);
    expect(json.data.timerStartedAt).toBeNull();
  });

  it("resets history on the clone", async () => {
    const session = sessionFor("u1", "311");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callClone(task.id, cloneRequest(task.id, session.id));

    const json = await response.json();
    expect(json.data.history).toEqual([]);
  });
});
