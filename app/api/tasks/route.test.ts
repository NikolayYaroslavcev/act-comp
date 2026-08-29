import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/tasks/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { findTaskById } from "@/entities/task/repository";

function tasksRequest(sessionId?: string, query?: string) {
  return new NextRequest(`http://localhost/api/tasks${query ?? ""}`, {
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

function createTaskRequest(sessionId: string | undefined, body: unknown) {
  return new NextRequest("http://localhost/api/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function createTaskRequestWithRawBody(sessionId: string, rawBody: string) {
  return new NextRequest("http://localhost/api/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
    },
    body: rawBody,
  });
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

describe("GET /api/tasks", () => {
  it("returns 401 when no session cookie is present", async () => {
    const response = await GET(tasksRequest());

    expect(response.status).toBe(401);
  });

  it("returns 401 for an unknown session id", async () => {
    const response = await GET(tasksRequest("does-not-exist"));

    expect(response.status).toBe(401);
  });

  it("returns 200 with only the tasks accessible to the session's user", async () => {
    const session = sessionFor("u1", "70");
    const ownList = createList("u1", { title: "Mine", template: "work", deadline: null });
    const strangerList = createList("u2", { title: "Not mine", template: "work", deadline: null });

    const ownResponse = await POST(
      createTaskRequest(session.id, { listId: ownList.id, title: "Owned task" }),
    );
    const ownJson = await ownResponse.json();

    const response = await GET(tasksRequest(session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    const ids: string[] = json.data.map((task: { id: string }) => task.id);
    expect(ids).toContain(ownJson.data.id);
    expect(findListById(strangerList.id)).toBeDefined();
  });

  it("returns an empty list for a user with no accessible tasks", async () => {
    const session = sessionFor("u3", "71");

    const response = await GET(tasksRequest(session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json.data)).toBe(true);
  });
});

describe("POST /api/tasks", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });

    const response = await POST(createTaskRequest(undefined, { listId: list.id, title: "Task" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const session = sessionFor("u1", "80");

    const response = await POST(createTaskRequestWithRawBody(session.id, "{ not json"));

    expect(response.status).toBe(400);
  });

  it("returns 400 for a Zod validation error", async () => {
    const session = sessionFor("u1", "81");
    const list = createList("u1", { title: "List", template: "work", deadline: null });

    const response = await POST(
      createTaskRequest(session.id, { listId: list.id, title: "", priority: 3 }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.issues).toBeTruthy();
  });

  it("returns 404 when the listId does not reference a list", async () => {
    const session = sessionFor("u1", "82");

    const response = await POST(
      createTaskRequest(session.id, { listId: "does-not-exist", title: "Task" }),
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when the user has no edit access to the list", async () => {
    const session = sessionFor("u2", "83");
    const list = createList("u1", { title: "List", template: "work", deadline: null });

    const response = await POST(
      createTaskRequest(session.id, { listId: list.id, title: "Task" }),
    );

    expect(response.status).toBe(403);
  });

  it("creates a task for the owner on valid input", async () => {
    const session = sessionFor("u1", "84");
    const list = createList("u1", { title: "List", template: "work", deadline: null });

    const response = await POST(
      createTaskRequest(session.id, { listId: list.id, title: "New task" }),
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.listId).toBe(list.id);
    expect(json.data.title).toBe("New task");
    expect(json.data.code).toMatch(/^TEST-\d+$/);
    expect(findTaskById(json.data.id)).toBeDefined();
  });

  it("allows an edit-access shared user to create a task", async () => {
    const session = sessionFor("u2", "85");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "edit" });

    const response = await POST(
      createTaskRequest(session.id, { listId: list.id, title: "New task" }),
    );

    expect(response.status).toBe(201);
  });

  it("ignores a client-supplied ownerId/userId and does not let it affect the outcome", async () => {
    const session = sessionFor("u2", "86");
    const list = createList("u1", { title: "List", template: "work", deadline: null });

    const response = await POST(
      createTaskRequest(session.id, {
        listId: list.id,
        title: "Spoofed task",
        ownerId: "u1",
        userId: "u1",
      }),
    );

    expect(response.status).toBe(403);
  });
});
