import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, PATCH } from "@/app/api/lists/[id]/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";
import { selectVisibleLists } from "@/entities/list/model";
import { getArchiveCandidates } from "@/features/dashboard/archive-candidates";
import { getDb } from "@/shared/lib/db";

function patchRequest(id: string, sessionId: string | undefined, body: unknown) {
  return new NextRequest(`http://localhost/api/lists/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function patchRequestWithRawBody(id: string, sessionId: string, rawBody: string) {
  return new NextRequest(`http://localhost/api/lists/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
    },
    body: rawBody,
  });
}

function callPatch(id: string, request: NextRequest) {
  return PATCH(request, { params: Promise.resolve({ id }) });
}

function deleteRequest(id: string, sessionId: string | undefined) {
  return new NextRequest(`http://localhost/api/lists/${id}`, {
    method: "DELETE",
    headers: {
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
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

describe("PATCH /api/lists/[id]", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, undefined, { title: "New" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const session = sessionFor("u1", "30");
    const list = createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequestWithRawBody(list.id, session.id, "{ not json"));

    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid field value", async () => {
    const session = sessionFor("u1", "31");
    const list = createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, { template: "hobby" }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.issues).toBeTruthy();
  });

  it("returns 400 for an empty patch", async () => {
    const session = sessionFor("u1", "32");
    const list = createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, {}));

    expect(response.status).toBe(400);
  });

  it("returns 404 for an unknown list id", async () => {
    const session = sessionFor("u1", "33");

    const response = await callPatch("does-not-exist", patchRequest("does-not-exist", session.id, { title: "New" }));

    expect(response.status).toBe(404);
  });

  it("returns 403 when the caller does not own or share the list", async () => {
    const stranger = sessionFor("u2", "35");
    const list = createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, stranger.id, { title: "Hijacked" }));

    expect(response.status).toBe(403);
    expect(findListById(list.id)?.title).toBe("Old");
  });

  it("returns 200 and applies the update for the owner", async () => {
    const session = sessionFor("u1", "36");
    const list = createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, { title: "New title" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.title).toBe("New title");
  });

  it("supports a partial update without resetting other fields", async () => {
    const session = sessionFor("u1", "37");
    const deadline = "2026-10-01T00:00:00.000Z";
    const list = createList("u1", { title: "Old", template: "project", deadline });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, { title: "New title" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.title).toBe("New title");
    expect(json.data.template).toBe("project");
    expect(json.data.deadline).toBe(deadline);
  });

  it("supports explicitly clearing the deadline to null", async () => {
    const session = sessionFor("u1", "38");
    const list = createList("u1", {
      title: "Old",
      template: "work",
      deadline: "2026-10-01T00:00:00.000Z",
    });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, { deadline: null }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.deadline).toBeNull();
  });

  it("records a history entry describing the change", async () => {
    const session = sessionFor("u1", "39");
    const list = createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, { title: "New title" }));

    const json = await response.json();
    expect(json.data.history).toHaveLength(1);
    expect(json.data.history[0]).toMatchObject({ field: "title", old: "Old", new: "New title" });
  });

  it("does not add a history entry for a no-op update", async () => {
    const session = sessionFor("u1", "40");
    const list = createList("u1", { title: "Same", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, { title: "Same" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.history).toEqual([]);
  });

  it("allows an edit-access shared user to update the list", async () => {
    const editor = sessionFor("u2", "41");
    const list = createList("u1", { title: "Old", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "edit" });

    const response = await callPatch(list.id, patchRequest(list.id, editor.id, { title: "Edited by collaborator" }));

    expect(response.status).toBe(200);
  });

  it("denies a read-only shared user from updating the list", async () => {
    const viewer = sessionFor("u2", "42");
    const list = createList("u1", { title: "Old", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "read" });

    const response = await callPatch(list.id, patchRequest(list.id, viewer.id, { title: "Hijacked" }));

    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/lists/[id]", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDelete(list.id, deleteRequest(list.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown list id", async () => {
    const session = sessionFor("u1", "50");

    const response = await callDelete("does-not-exist", deleteRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("returns 403 when the caller does not own the list", async () => {
    const stranger = sessionFor("u2", "51");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDelete(list.id, deleteRequest(list.id, stranger.id));

    expect(response.status).toBe(403);
    expect(findListById(list.id)?.deletedAt).toBeNull();
  });

  it("returns 403 for an edit-access shared user", async () => {
    const editor = sessionFor("u2", "52");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    findListById(list.id)!.sharedWith.push({ userId: "u2", access: "edit" });

    const response = await callDelete(list.id, deleteRequest(list.id, editor.id));

    expect(response.status).toBe(403);
  });

  it("returns 200 and sets deletedAt for the owner", async () => {
    const session = sessionFor("u1", "53");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDelete(list.id, deleteRequest(list.id, session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.deletedAt).not.toBeNull();
  });

  it("keeps the physical record in storage after deletion", async () => {
    const session = sessionFor("u1", "54");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });

    await callDelete(list.id, deleteRequest(list.id, session.id));

    expect(findListById(list.id)).toBeDefined();
  });

  it("records a history entry describing the deletion", async () => {
    const session = sessionFor("u1", "55");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDelete(list.id, deleteRequest(list.id, session.id));

    const json = await response.json();
    expect(json.data.history).toHaveLength(1);
    expect(json.data.history[0]).toMatchObject({ field: "deletedAt", old: null });
  });

  it("is idempotent when deleting an already-deleted list", async () => {
    const session = sessionFor("u1", "56");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });

    const first = await callDelete(list.id, deleteRequest(list.id, session.id));
    const firstJson = await first.json();
    const second = await callDelete(list.id, deleteRequest(list.id, session.id));
    const secondJson = await second.json();

    expect(second.status).toBe(200);
    expect(secondJson.data.deletedAt).toBe(firstJson.data.deletedAt);
    expect(secondJson.data.history).toHaveLength(1);
  });

  it("removes the deleted list from the owner's visible lists", async () => {
    const session = sessionFor("u1", "57");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });

    await callDelete(list.id, deleteRequest(list.id, session.id));

    const visible = selectVisibleLists([findListById(list.id)!], "u1");
    expect(visible).toEqual([]);
  });

  it("removes the deleted list from Smart Archive candidates even when its last activity is stale", async () => {
    const session = sessionFor("u1", "58");
    const list = createList("u1", { title: "Owned", template: "work", deadline: null });
    const now = new Date("2026-09-18T14:00:00.000Z");
    const staleActivityAt = "2026-08-01T00:00:00.000Z";
    getDb().activityLog[`a-route-delete-${list.id}`] = {
      id: `a-route-delete-${list.id}`,
      entityType: "list",
      entityId: list.id,
      action: "created",
      at: staleActivityAt,
      byUserId: "u1",
    };

    const beforeDelete = getArchiveCandidates("u1", now);
    expect(beforeDelete.some((candidate) => candidate.id === list.id)).toBe(true);

    await callDelete(list.id, deleteRequest(list.id, session.id));

    const afterDelete = getArchiveCandidates("u1", now);
    expect(afterDelete.some((candidate) => candidate.id === list.id)).toBe(false);
  });
});
