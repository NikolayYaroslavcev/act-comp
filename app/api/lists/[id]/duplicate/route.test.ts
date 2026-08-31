import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/lists/[id]/duplicate/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, findTaskById } from "@/entities/task/repository";

function duplicateRequest(id: string, sessionId: string | undefined, body?: unknown) {
  return new NextRequest(`http://localhost/api/lists/${id}/duplicate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
}

function duplicateRequestWithRawBody(id: string, sessionId: string, rawBody: string) {
  return new NextRequest(`http://localhost/api/lists/${id}/duplicate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
    },
    body: rawBody,
  });
}

async function callDuplicate(id: string, request: NextRequest) {
  return await POST(request, { params: Promise.resolve({ id }) });
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

describe("POST /api/lists/[id]/duplicate", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDuplicate(list.id, duplicateRequest(list.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown source list id", async () => {
    const session = await sessionFor("u1", "80");

    const response = await callDuplicate("does-not-exist", duplicateRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 when the caller has no relation to the source list", async () => {
    const stranger = await sessionFor("u2", "81");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDuplicate(list.id, duplicateRequest(list.id, stranger.id));

    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid JSON", async () => {
    const session = await sessionFor("u1", "82");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDuplicate(list.id, duplicateRequestWithRawBody(list.id, session.id, "{not-json"));

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid copy options", async () => {
    const session = await sessionFor("u1", "83");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDuplicate(
      list.id,
      duplicateRequest(list.id, session.id, { copyTasks: "yes" }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 201 and a new list owned by the caller for the owner", async () => {
    const session = await sessionFor("u1", "84");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDuplicate(list.id, duplicateRequest(list.id, session.id));

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.id).not.toBe(list.id);
    expect(json.data.ownerId).toBe("u1");
  });

  it("cannot be used to spoof ownership via the request body", async () => {
    const session = await sessionFor("u1", "85");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDuplicate(
      list.id,
      duplicateRequest(list.id, session.id, { ownerId: "u2" }),
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.ownerId).toBe("u1");
  });

  it("does not modify the original list", async () => {
    const session = await sessionFor("u1", "86");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const snapshot = { ...(await findListById(list.id))! };

    await callDuplicate(list.id, duplicateRequest(list.id, session.id));

    expect(await findListById(list.id)).toEqual(snapshot);
  });

  it("creates another new list on a repeated call", async () => {
    const session = await sessionFor("u1", "87");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const first = await callDuplicate(list.id, duplicateRequest(list.id, session.id));
    const second = await callDuplicate(list.id, duplicateRequest(list.id, session.id));

    const firstJson = await first.json();
    const secondJson = await second.json();
    expect(firstJson.data.id).not.toBe(secondJson.data.id);
  });

  it("does not copy tasks by default", async () => {
    const session = await sessionFor("u1", "88");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    await createTask({
      listId: list.id,
      title: "Task A",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const response = await callDuplicate(list.id, duplicateRequest(list.id, session.id));

    const json = await response.json();
    expect(json.data.taskIds).toEqual([]);
  });

  it("copies tasks with new ids when copyTasks is true", async () => {
    const session = await sessionFor("u1", "89");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const task = await createTask({
      listId: list.id,
      title: "Task A",
      description: "",
      priority: 3,
      category: null,
      tags: [],
      parentId: null,
      deadline: null,
      estimatedMin: 0,
    });

    const response = await callDuplicate(list.id, duplicateRequest(list.id, session.id, { copyTasks: true }));

    const json = await response.json();
    expect(json.data.taskIds).toHaveLength(1);
    expect(json.data.taskIds[0]).not.toBe(task.id);
    const newTask = await findTaskById(json.data.taskIds[0]);
    expect(newTask?.listId).toBe(json.data.id);
  });

  it("returns 404 for a soft-deleted source list", async () => {
    const session = await sessionFor("u1", "90");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.deletedAt = new Date().toISOString();

    const response = await callDuplicate(list.id, duplicateRequest(list.id, session.id));

    expect(response.status).toBe(404);
  });
});
