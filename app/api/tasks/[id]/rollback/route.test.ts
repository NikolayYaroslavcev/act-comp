import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/tasks/[id]/rollback/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { createTask, findTaskById, insertTasks, updateTask } from "@/entities/task/repository";

function rollbackRequest(id: string, sessionId: string | undefined, body: unknown) {
  return new NextRequest(`http://localhost/api/tasks/${id}/rollback`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function callRollback(id: string, request: NextRequest) {
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

describe("POST /api/tasks/[id]/rollback", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callRollback(task.id, rollbackRequest(task.id, undefined, { historyIndex: 0 }));

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const session = await sessionFor("u1", "400");
    const request = new NextRequest("http://localhost/api/tasks/t1/rollback", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${session.id}` },
      body: "{",
    });

    const response = await callRollback("t1", request);

    expect(response.status).toBe(400);
  });

  it("returns 400 when historyIndex is missing", async () => {
    const session = await sessionFor("u1", "401");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);

    const response = await callRollback(task.id, rollbackRequest(task.id, session.id, {}));

    expect(response.status).toBe(400);
  });

  it("returns 400 for an unknown history index", async () => {
    const session = await sessionFor("u1", "402");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await updateTask(task.id, "u1", { title: "Updated" });

    const response = await callRollback(task.id, rollbackRequest(task.id, session.id, { historyIndex: 9 }));

    expect(response.status).toBe(400);
    expect((await findTaskById(task.id))!.title).toBe("Updated");
  });

  it("returns 400 when the history index belongs to a longer history on a different task", async () => {
    const session = await sessionFor("u1", "403");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await updateTask(task.id, "u1", { title: "Updated" });
    const other = await makeTaskIn(list.id);
    await updateTask(other.id, "u1", { title: "Other-1" });
    await updateTask(other.id, "u1", { title: "Other-2" });

    const response = await callRollback(task.id, rollbackRequest(task.id, session.id, { historyIndex: 1 }));

    expect(response.status).toBe(400);
    expect((await findTaskById(task.id))!.title).toBe("Updated");
  });

  it("returns 404 for an inaccessible task", async () => {
    const stranger = await sessionFor("u2", "404");
    const list = await createList("u1", { title: "Private", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await updateTask(task.id, "u1", { title: "Updated" });

    const response = await callRollback(task.id, rollbackRequest(task.id, stranger.id, { historyIndex: 0 }));

    expect(response.status).toBe(404);
  });

  it("returns 403 for shared read access", async () => {
    const viewer = await sessionFor("u2", "405");
    const list = await createList("u1", { title: "Shared", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });
    const task = await makeTaskIn(list.id);
    await updateTask(task.id, "u1", { title: "Updated" });

    const response = await callRollback(task.id, rollbackRequest(task.id, viewer.id, { historyIndex: 0 }));

    expect(response.status).toBe(403);
    expect((await findTaskById(task.id))!.title).toBe("Updated");
  });

  it("returns 200 and restored fields for the owner", async () => {
    const session = await sessionFor("u1", "406");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const task = await makeTaskIn(list.id);
    await updateTask(task.id, "u1", { title: "Updated" });

    const response = await callRollback(task.id, rollbackRequest(task.id, session.id, { historyIndex: 0 }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.task.title).toBe("Task");
    expect((await findTaskById(task.id))!.title).toBe("Task");
  });

  it("returns 400 for an invalid restored parent without changing the task", async () => {
    const session = await sessionFor("u1", "407");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const child = await makeTaskIn(list.id);
    await insertTasks([
      {
        ...child,
        parentId: null,
        history: [{ field: "parentId", old: "missing-parent", new: null, at: "2026-08-10T10:00:00.000Z", byUserId: "u1" }],
      },
    ]);

    const response = await callRollback(child.id, rollbackRequest(child.id, session.id, { historyIndex: 0 }));

    expect(response.status).toBe(400);
    expect((await findTaskById(child.id))!.parentId).toBeNull();
  });

  it("returns 409 when restored dependsOn would create a cycle, without changing the task", async () => {
    const session = await sessionFor("u1", "408");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const a = await makeTaskIn(list.id);
    const b = await makeTaskIn(list.id);
    await updateTask(a.id, "u1", { dependsOn: [b.id] });
    await insertTasks([
      {
        ...(await findTaskById(b.id))!,
        dependsOn: [],
        history: [{ field: "dependsOn", old: [a.id], new: [], at: "2026-08-10T10:00:00.000Z", byUserId: "u1" }],
      },
    ]);

    const response = await callRollback(b.id, rollbackRequest(b.id, session.id, { historyIndex: 0 }));

    expect(response.status).toBe(409);
    expect((await findTaskById(b.id))!.dependsOn).toEqual([]);
  });

  it("returns 400 when restored dependsOn points at another list", async () => {
    const session = await sessionFor("u1", "409");
    const list = await createList("u1", { title: "List", template: "work", deadline: null });
    const other = await createList("u1", { title: "Other", template: "work", deadline: null });
    const foreign = await makeTaskIn(other.id);
    const task = await makeTaskIn(list.id);
    await insertTasks([
      {
        ...task,
        dependsOn: [],
        history: [{ field: "dependsOn", old: [foreign.id], new: [], at: "2026-08-10T10:00:00.000Z", byUserId: "u1" }],
      },
    ]);

    const response = await callRollback(task.id, rollbackRequest(task.id, session.id, { historyIndex: 0 }));

    expect(response.status).toBe(400);
    expect((await findTaskById(task.id))!.dependsOn).toEqual([]);
  });
});
