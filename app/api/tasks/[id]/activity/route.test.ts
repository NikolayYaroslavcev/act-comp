import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/tasks/[id]/activity/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession, revokeSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, insertTasks, updateTask } from "@/entities/task/repository";
import { recordActivity } from "@/entities/activity/repository";

function activityRequest(taskId: string, sessionId: string | undefined, query = "") {
  return new NextRequest(`http://localhost/api/tasks/${taskId}/activity${query}`, {
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

describe("GET /api/tasks/[id]/activity", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callGet(task.id, activityRequest(task.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 401 for a revoked session", async () => {
    const session = sessionFor("u1", "500");
    revokeSession(session.id);
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callGet(task.id, activityRequest(task.id, session.id));

    expect(response.status).toBe(401);
  });

  it("returns 200 with activity for the owner, newest first", async () => {
    const session = sessionFor("u1", "501");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    recordActivity({
      entityType: "task",
      entityId: task.id,
      action: "created",
      at: "2026-08-30T09:00:00.000Z",
      byUserId: "u1",
    });
    updateTask(task.id, "u1", { priority: 5 }, new Date("2026-08-30T10:00:00.000Z"));

    const response = await callGet(task.id, activityRequest(task.id, session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data[0].at >= json.data[json.data.length - 1].at).toBe(true);
    expect(json.data[0].actorEmail).toBe("admin@example.com");
    expect(json.data.some((item: { action: string }) => item.action === "updated")).toBe(true);
  });

  it("returns 200 for shared-read and shared-edit", async () => {
    const reader = sessionFor("u2", "502");
    const editor = sessionFor("u3", "503");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" }, { userId: "u3", access: "edit" });
    const task = makeTaskIn(list.id);

    expect((await callGet(task.id, activityRequest(task.id, reader.id))).status).toBe(200);
    expect((await callGet(task.id, activityRequest(task.id, editor.id))).status).toBe(200);
  });

  it("returns 404 for an unknown task", async () => {
    const session = sessionFor("u1", "504");

    const response = await callGet("does-not-exist", activityRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for another user's private task", async () => {
    const session = sessionFor("u2", "505");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callGet(task.id, activityRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a soft-deleted task", async () => {
    const session = sessionFor("u1", "506");
    const list = createList("u1", { title: "List", template: "work", deadline: null });
    const task = makeTaskIn(list.id);
    insertTasks([{ ...task, deletedAt: "2026-08-01T00:00:00.000Z" }]);

    const response = await callGet(task.id, activityRequest(task.id, session.id));

    expect(response.status).toBe(404);
  });

  it("ignores a spoofed userId query parameter and uses the session user", async () => {
    const session = sessionFor("u2", "507");
    const list = createList("u1", { title: "Private", template: "work", deadline: null });
    const task = makeTaskIn(list.id);

    const response = await callGet(task.id, activityRequest(task.id, session.id, "?userId=u1"));

    expect(response.status).toBe(404);
  });
});
