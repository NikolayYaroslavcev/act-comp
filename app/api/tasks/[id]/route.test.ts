import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH } from "@/app/api/tasks/[id]/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession, revokeSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, findTaskById, insertTasks } from "@/entities/task/repository";

function getRequest(id: string, sessionId: string | undefined) {
  return new NextRequest(`http://localhost/api/tasks/${id}`, {
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

function callGet(id: string, request: NextRequest) {
  return GET(request, { params: Promise.resolve({ id }) });
}

function patchRequest(id: string, sessionId: string | undefined, body: unknown) {
  return new NextRequest(`http://localhost/api/tasks/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function patchRequestWithRawBody(id: string, sessionId: string, rawBody: string) {
  return new NextRequest(`http://localhost/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${sessionId}` },
    body: rawBody,
  });
}

function callPatch(id: string, request: NextRequest) {
  return PATCH(request, { params: Promise.resolve({ id }) });
}

function deleteRequest(id: string, sessionId: string | undefined) {
  return new NextRequest(`http://localhost/api/tasks/${id}`, {
    method: "DELETE",
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

function callDelete(id: string, request: NextRequest) {
  return DELETE(request, { params: Promise.resolve({ id }) });
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

describe("GET /api/tasks/[id]", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callGet(task.id, getRequest(task.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 200 with the task for its owner", async () => {
    const session = sessionFor("u1", "90");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callGet(task.id, getRequest(task.id, session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.id).toBe(task.id);
  });

  it("returns 200 with the task for a user it is shared with", async () => {
    const session = sessionFor("u2", "91");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });
    const task = makeTaskIn(list.id);

    const response = await callGet(task.id, getRequest(task.id, session.id));

    expect(response.status).toBe(200);
  });

  it("returns 404 for an unknown task id", async () => {
    const session = sessionFor("u1", "92");

    const response = await callGet("does-not-exist", getRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 (not a leaking 403) for another user's task", async () => {
    const session = sessionFor("u2", "93");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callGet(task.id, getRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a soft-deleted task", async () => {
    const session = sessionFor("u1", "94");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const response = await callGet(task.id, getRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/tasks/[id]", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, undefined, { title: "Updated" }));

    expect(response.status).toBe(401);
  });

  it("returns 401 for an unknown session id", async () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, "does-not-exist", { title: "Updated" }));

    expect(response.status).toBe(401);
  });

  it("returns 401 for a revoked session", async () => {
    const session = sessionFor("u1", "100");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    revokeSession(session.id);

    const response = await callPatch(task.id, patchRequest(task.id, session.id, { title: "Updated" }));

    expect(response.status).toBe(401);
  });

  it("allows the owner to update the task", async () => {
    const session = sessionFor("u1", "101");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, session.id, { title: "Updated" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.task.title).toBe("Updated");
  });

  it("allows a shared edit-access user to update the task", async () => {
    const session = sessionFor("u2", "102");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "edit" });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, session.id, { title: "Updated" }));

    expect(response.status).toBe(200);
  });

  it("returns 403 for a shared read-access user", async () => {
    const session = sessionFor("u2", "103");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, session.id, { title: "Updated" }));

    expect(response.status).toBe(403);
    expect(findTaskById(task.id)!.title).toBe("Task");
  });

  it("returns 404 (not a leaking 403) for a user with no access at all", async () => {
    const session = sessionFor("u2", "104");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, session.id, { title: "Updated" }));

    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown task id", async () => {
    const session = sessionFor("u1", "105");

    const response = await callPatch("does-not-exist", patchRequest("does-not-exist", session.id, { title: "Updated" }));

    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid JSON", async () => {
    const session = sessionFor("u1", "106");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequestWithRawBody(task.id, session.id, "{ not json"));

    expect(response.status).toBe(400);
  });

  it("returns 400 for an empty patch", async () => {
    const session = sessionFor("u1", "107");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, session.id, {}));

    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid field value", async () => {
    const session = sessionFor("u1", "108");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, session.id, { priority: 99 }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.issues).toBeTruthy();
  });

  it("applies a partial update without resetting other fields", async () => {
    const session = sessionFor("u1", "109");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, session.id, { title: "Only title" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.task.description).toBe(task.description);
    expect(json.data.task.priority).toBe(task.priority);
    expect(json.data.task.status).toBe(task.status);
  });

  it("treats an explicit null deadline differently from an omitted one", async () => {
    const session = sessionFor("u1", "110");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = createTask({
      listId: list.id,
      title: "Task",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: "2026-09-01T00:00:00.000Z",
      estimatedMin: 0,
    });

    const response = await callPatch(task.id, patchRequest(task.id, session.id, { deadline: null }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.task.deadline).toBeNull();
  });

  it("does not let the client change server-owned fields", async () => {
    const session = sessionFor("u1", "111");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(
      task.id,
      patchRequest(task.id, session.id, {
        title: "Updated",
        id: "spoofed-id",
        listId: "spoofed-list",
        code: "TEST-999",
        createdAt: "2020-01-01T00:00:00.000Z",
        deletedAt: "2020-01-01T00:00:00.000Z",
        history: [{ field: "title", old: "x", new: "y", at: "2020-01-01T00:00:00.000Z", byUserId: "u1" }],
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.task.id).toBe(task.id);
    expect(json.data.task.listId).toBe(list.id);
    expect(json.data.task.code).toBe(task.code);
    expect(json.data.task.createdAt).toBe(task.createdAt);
    expect(json.data.task.deletedAt).toBeNull();
  });

  it("cannot move a task to another list via a spoofed listId", async () => {
    const session = sessionFor("u1", "112");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const otherList = createList("u1", { title: "Other", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    await callPatch(task.id, patchRequest(task.id, session.id, { title: "Updated", listId: otherList.id }));

    expect(findTaskById(task.id)!.listId).toBe(list.id);
  });

  it("records a history entry reflecting the actual field change", async () => {
    const session = sessionFor("u1", "113");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, session.id, { priority: 4 }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.task.history).toEqual([
      expect.objectContaining({ field: "priority", old: 3, new: 4, byUserId: "u1" }),
    ]);
  });

  it("does not add a history entry for a no-op patch", async () => {
    const session = sessionFor("u1", "114");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, session.id, { title: "Task" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.task.history).toEqual([]);
  });

  it("returns 409 for a dependsOn update that would create a cycle, without saving it", async () => {
    const session = sessionFor("u1", "115");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, session.id, { dependsOn: [task.id] }));

    expect(response.status).toBe(409);
    expect(findTaskById(task.id)!.dependsOn).toEqual([]);
  });

  it("triggers a cascade recalculation for downstream tasks on status change", async () => {
    const session = sessionFor("u1", "116");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const blocker = makeTaskIn(list.id);
    const dependent = createTask({
      listId: list.id,
      title: "Dependent",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });
    insertTasks([{ ...dependent, dependsOn: [blocker.id] }]);

    const response = await callPatch(blocker.id, patchRequest(blocker.id, session.id, { status: "done" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    const cascadeIds = json.data.cascade.map((update: { taskId: string }) => update.taskId);
    expect(cascadeIds).toContain(dependent.id);
  });

  it("does not include unrelated tasks in the cascade result", async () => {
    const session = sessionFor("u1", "117");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const blocker = makeTaskIn(list.id);
    const independent = createTask({
      listId: list.id,
      title: "Independent",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const response = await callPatch(blocker.id, patchRequest(blocker.id, session.id, { status: "done" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    const cascadeIds = json.data.cascade.map((update: { taskId: string }) => update.taskId);
    expect(cascadeIds).not.toContain(independent.id);
  });

  it("does not compute a cascade when status is not changed", async () => {
    const session = sessionFor("u1", "118");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callPatch(task.id, patchRequest(task.id, session.id, { title: "Updated" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.cascade).toEqual([]);
  });

  it("does not affect other tasks/lists it does not touch (regression)", async () => {
    const session = sessionFor("u1", "119");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const untouched = makeTaskIn(list.id);
    const target = makeTaskIn(list.id);

    await callPatch(target.id, patchRequest(target.id, session.id, { title: "Updated" }));

    expect(findTaskById(untouched.id)!.title).toBe("Task");
  });
});

describe("DELETE /api/tasks/[id]", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callDelete(task.id, deleteRequest(task.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 401 for an unknown session id", async () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callDelete(task.id, deleteRequest(task.id, "does-not-exist"));

    expect(response.status).toBe(401);
  });

  it("returns 401 for a revoked session", async () => {
    const session = sessionFor("u1", "200");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    revokeSession(session.id);

    const response = await callDelete(task.id, deleteRequest(task.id, session.id));

    expect(response.status).toBe(401);
  });

  it("allows the owner to soft-delete the task", async () => {
    const session = sessionFor("u1", "201");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callDelete(task.id, deleteRequest(task.id, session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.deletedAt).not.toBeNull();
  });

  it("returns 403 for a shared edit-access user (not the owner)", async () => {
    const session = sessionFor("u2", "202");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "edit" });
    const task = makeTaskIn(list.id);

    const response = await callDelete(task.id, deleteRequest(task.id, session.id));

    expect(response.status).toBe(403);
    expect(findTaskById(task.id)!.deletedAt).toBeNull();
  });

  it("returns 403 for a shared read-access user", async () => {
    const session = sessionFor("u2", "203");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });
    const task = makeTaskIn(list.id);

    const response = await callDelete(task.id, deleteRequest(task.id, session.id));

    expect(response.status).toBe(403);
  });

  it("returns 404 (not a leaking 403) for a user with no access at all", async () => {
    const session = sessionFor("u2", "204");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callDelete(task.id, deleteRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown task id", async () => {
    const session = sessionFor("u1", "205");

    const response = await callDelete("does-not-exist", deleteRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("keeps the task in storage rather than removing it (soft delete)", async () => {
    const session = sessionFor("u1", "206");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    await callDelete(task.id, deleteRequest(task.id, session.id));

    const stored = findTaskById(task.id);
    expect(stored).toBeDefined();
    expect(stored!.title).toBe("Task");
  });

  it("records a history entry for the deletion", async () => {
    const session = sessionFor("u1", "207");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callDelete(task.id, deleteRequest(task.id, session.id));

    const json = await response.json();
    expect(json.data.history).toEqual([
      expect.objectContaining({ field: "deletedAt", old: null, byUserId: "u1" }),
    ]);
  });

  it("removes the task from the normal GET /api/tasks/[id] flow after deletion", async () => {
    const session = sessionFor("u1", "208");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    await callDelete(task.id, deleteRequest(task.id, session.id));
    const response = await callGet(task.id, getRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });

  it("is idempotent: a repeated DELETE returns 200 without changing deletedAt or adding history", async () => {
    const session = sessionFor("u1", "209");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const first = await callDelete(task.id, deleteRequest(task.id, session.id));
    const firstJson = await first.json();
    const firstDeletedAt = firstJson.data.deletedAt;

    const second = await callDelete(task.id, deleteRequest(task.id, session.id));

    expect(second.status).toBe(200);
    const secondJson = await second.json();
    expect(secondJson.data.deletedAt).toBe(firstDeletedAt);
    expect(secondJson.data.history).toEqual(firstJson.data.history);
  });

  it("does not affect other tasks it does not touch (regression)", async () => {
    const session = sessionFor("u1", "210");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const untouched = makeTaskIn(list.id);
    const target = makeTaskIn(list.id);

    await callDelete(target.id, deleteRequest(target.id, session.id));

    expect(findTaskById(untouched.id)!.deletedAt).toBeNull();
  });
});
