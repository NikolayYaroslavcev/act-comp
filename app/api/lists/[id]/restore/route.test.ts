import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/lists/[id]/restore/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { selectVisibleLists } from "@/entities/list/model";

function restoreRequest(id: string, sessionId: string | undefined) {
  return new NextRequest(`http://localhost/api/lists/${id}/restore`, {
    method: "POST",
    headers: {
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
  });
}

function callRestore(id: string, request: NextRequest) {
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

describe("POST /api/lists/[id]/restore", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callRestore(list.id, restoreRequest(list.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown list id", async () => {
    const session = sessionFor("u1", "70");

    const response = await callRestore("does-not-exist", restoreRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("returns 403 when the caller does not own the deleted list", async () => {
    const stranger = sessionFor("u2", "72");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.deletedAt = new Date().toISOString();

    const response = await callRestore(list.id, restoreRequest(list.id, stranger.id));

    expect(response.status).toBe(403);
  });

  it("returns 403 for an edit-access shared user", async () => {
    const editor = sessionFor("u2", "73");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "edit" });
    findListById(list.id)!.deletedAt = new Date().toISOString();

    const response = await callRestore(list.id, restoreRequest(list.id, editor.id));

    expect(response.status).toBe(403);
  });

  it("returns 200 and clears deletedAt for the owner within the restore window", async () => {
    const session = sessionFor("u1", "74");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.deletedAt = new Date().toISOString();

    const response = await callRestore(list.id, restoreRequest(list.id, session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.deletedAt).toBeNull();
  });

  it("returns 409 when the restore window has expired", async () => {
    const session = sessionFor("u1", "75");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const expired = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    findListById(list.id)!.deletedAt = expired;

    const response = await callRestore(list.id, restoreRequest(list.id, session.id));

    expect(response.status).toBe(409);
  });

  it("is idempotent (200) when restoring a list that is not deleted", async () => {
    const session = sessionFor("u1", "76");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callRestore(list.id, restoreRequest(list.id, session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.deletedAt).toBeNull();
  });

  it("makes the restored list visible again to the owner", async () => {
    const session = sessionFor("u1", "77");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.deletedAt = new Date().toISOString();

    await callRestore(list.id, restoreRequest(list.id, session.id));

    const visible = selectVisibleLists([findListById(list.id)!], "u1");
    expect(visible).toEqual([findListById(list.id)]);
  });

  it("records a history entry describing the restoration", async () => {
    const session = sessionFor("u1", "78");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const deletedAt = new Date().toISOString();
    findListById(list.id)!.deletedAt = deletedAt;

    const response = await callRestore(list.id, restoreRequest(list.id, session.id));

    const json = await response.json();
    expect(json.data.history).toHaveLength(1);
    expect(json.data.history[0]).toMatchObject({ field: "deletedAt", old: deletedAt, new: null });
  });
});
