import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/tasks/[id]/timer/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { applyTaskTimer, createTask, findTaskById, insertTasks } from "@/entities/task/repository";

function timerRequest(id: string, sessionId: string | undefined, body: unknown) {
  return new NextRequest(`http://localhost/api/tasks/${id}/timer`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function callTimer(id: string, request: NextRequest) {
  return await POST(request, { params: Promise.resolve({ id }) });
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

describe("POST /api/tasks/[id]/timer", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callTimer(task.id, timerRequest(task.id, undefined, { action: "start" }));

    expect(response.status).toBe(401);
  });

  it("returns 200 and starts the timer for the owner", async () => {
    const session = await sessionFor("u1", "40");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callTimer(task.id, timerRequest(task.id, session.id, { action: "start" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.timerStartedAt).toBeTruthy();
    expect((await findTaskById(task.id))?.timerStartedAt).toBe(json.data.timerStartedAt);
  });

  it("returns 403 for shared read access", async () => {
    const session = await sessionFor("u2", "41");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });
    const task = await makeTaskIn(list.id);

    const response = await callTimer(task.id, timerRequest(task.id, session.id, { action: "start" }));

    expect(response.status).toBe(403);
  });

  it("returns 200 for shared edit access", async () => {
    const session = await sessionFor("u2", "42");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "edit" });
    const task = await makeTaskIn(list.id);

    const response = await callTimer(task.id, timerRequest(task.id, session.id, { action: "start" }));

    expect(response.status).toBe(200);
  });

  it("returns 404 for an unknown task", async () => {
    const session = await sessionFor("u1", "43");

    const response = await callTimer("missing", timerRequest("missing", session.id, { action: "start" }));

    expect(response.status).toBe(404);
  });

  it("returns 404 (not 403) for another user's task", async () => {
    const session = await sessionFor("u2", "44");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callTimer(task.id, timerRequest(task.id, session.id, { action: "start" }));

    expect(response.status).toBe(404);
  });

  it("returns 409 for a completed task", async () => {
    const session = await sessionFor("u1", "45");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await insertTasks([{ ...task, status: "done" }]);

    const response = await callTimer(task.id, timerRequest(task.id, session.id, { action: "start" }));

    expect(response.status).toBe(409);
  });

  it("returns 409 for a duplicate start", async () => {
    const session = await sessionFor("u1", "46");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await applyTaskTimer(task.id, "u1", "start", new Date("2026-08-29T10:00:00.000Z"));

    const response = await callTimer(task.id, timerRequest(task.id, session.id, { action: "start" }));

    expect(response.status).toBe(409);
    expect((await findTaskById(task.id))?.timerStartedAt).toBe("2026-08-29T10:00:00.000Z");
  });

  it("returns 400 when server-owned fields are supplied", async () => {
    const session = await sessionFor("u1", "47");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callTimer(
      task.id,
      timerRequest(task.id, session.id, {
        action: "start",
        timerStartedAt: "1999-01-01T00:00:00.000Z",
        timeSpentMin: 40,
      }),
    );

    expect(response.status).toBe(400);
    expect((await findTaskById(task.id))?.timerStartedAt).toBeNull();
  });

  it("pauses, resumes and stops through the same endpoint", async () => {
    const session = await sessionFor("u1", "48");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    expect((await callTimer(task.id, timerRequest(task.id, session.id, { action: "start" }))).status).toBe(200);
    expect((await callTimer(task.id, timerRequest(task.id, session.id, { action: "pause" }))).status).toBe(200);
    expect((await callTimer(task.id, timerRequest(task.id, session.id, { action: "resume" }))).status).toBe(200);
    expect((await callTimer(task.id, timerRequest(task.id, session.id, { action: "stop" }))).status).toBe(200);

    const stored = (await findTaskById(task.id))!;
    expect(stored.timerStartedAt).toBeNull();
    expect(stored.timerPausedAt).toBeNull();
  });
});
