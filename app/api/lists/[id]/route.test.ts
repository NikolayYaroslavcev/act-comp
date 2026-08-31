import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH } from "@/app/api/lists/[id]/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession, revokeSession } from "@/entities/session/repository";
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

async function callPatch(id: string, request: NextRequest) {
  return await PATCH(request, { params: Promise.resolve({ id }) });
}

function deleteRequest(id: string, sessionId: string | undefined) {
  return new NextRequest(`http://localhost/api/lists/${id}`, {
    method: "DELETE",
    headers: {
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
  });
}

async function callDelete(id: string, request: NextRequest) {
  return await DELETE(request, { params: Promise.resolve({ id }) });
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

function getRequest(id: string, sessionId: string | undefined) {
  return new NextRequest(`http://localhost/api/lists/${id}`, {
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

async function callGet(id: string, request: NextRequest) {
  return await GET(request, { params: Promise.resolve({ id }) });
}

describe("GET /api/lists/[id]", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callGet(list.id, getRequest(list.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 401 for a revoked session", async () => {
    const session = await sessionFor("u1", "70");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    await revokeSession(session.id);

    const response = await callGet(list.id, getRequest(list.id, session.id));

    expect(response.status).toBe(401);
  });

  it("returns 200 for the owner", async () => {
    const session = await sessionFor("u1", "71");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callGet(list.id, getRequest(list.id, session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.id).toBe(list.id);
  });

  it("returns 200 for a read-access shared user", async () => {
    const viewer = await sessionFor("u2", "72");
    const list = await createList("u1", { title: "Shared read", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });

    const response = await callGet(list.id, getRequest(list.id, viewer.id));

    expect(response.status).toBe(200);
  });

  it("returns 200 for an edit-access shared user", async () => {
    const editor = await sessionFor("u2", "73");
    const list = await createList("u1", { title: "Shared edit", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "edit" });

    const response = await callGet(list.id, getRequest(list.id, editor.id));

    expect(response.status).toBe(200);
  });

  it("returns 404 for an unknown list id", async () => {
    const session = await sessionFor("u1", "74");

    const response = await callGet("does-not-exist", getRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 instead of 403 for a private list owned by another user", async () => {
    const stranger = await sessionFor("u2", "75");
    const list = await createList("u1", { title: "Private", template: "work", deadline: null });

    const response = await callGet(list.id, getRequest(list.id, stranger.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 for a soft-deleted list, even for its owner", async () => {
    const session = await sessionFor("u1", "76");
    const list = await createList("u1", { title: "Deleted", template: "work", deadline: null });
    (await findListById(list.id))!.deletedAt = "2026-08-01T00:00:00.000Z";

    const response = await callGet(list.id, getRequest(list.id, session.id));

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/lists/[id]", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, undefined, { title: "New" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const session = await sessionFor("u1", "30");
    const list = await createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequestWithRawBody(list.id, session.id, "{ not json"));

    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid field value", async () => {
    const session = await sessionFor("u1", "31");
    const list = await createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, { template: "hobby" }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.issues).toBeTruthy();
  });

  it("returns 400 for an empty patch", async () => {
    const session = await sessionFor("u1", "32");
    const list = await createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, {}));

    expect(response.status).toBe(400);
  });

  it("returns 404 for an unknown list id", async () => {
    const session = await sessionFor("u1", "33");

    const response = await callPatch("does-not-exist", patchRequest("does-not-exist", session.id, { title: "New" }));

    expect(response.status).toBe(404);
  });

  it("returns 404 instead of 403 for a private list the caller cannot view", async () => {
    const stranger = await sessionFor("u2", "35");
    const list = await createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, stranger.id, { title: "Hijacked" }));

    expect(response.status).toBe(404);
    expect((await findListById(list.id))?.title).toBe("Old");
  });

  it("returns 200 and applies the update for the owner", async () => {
    const session = await sessionFor("u1", "36");
    const list = await createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, { title: "New title" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.title).toBe("New title");
  });

  it("supports a partial update without resetting other fields", async () => {
    const session = await sessionFor("u1", "37");
    const deadline = "2026-10-01T00:00:00.000Z";
    const list = await createList("u1", { title: "Old", template: "project", deadline });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, { title: "New title" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.title).toBe("New title");
    expect(json.data.template).toBe("project");
    expect(json.data.deadline).toBe(deadline);
  });

  it("supports explicitly clearing the deadline to null", async () => {
    const session = await sessionFor("u1", "38");
    const list = await createList("u1", {
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
    const session = await sessionFor("u1", "39");
    const list = await createList("u1", { title: "Old", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, { title: "New title" }));

    const json = await response.json();
    expect(json.data.history).toHaveLength(1);
    expect(json.data.history[0]).toMatchObject({ field: "title", old: "Old", new: "New title" });
  });

  it("does not add a history entry for a no-op update", async () => {
    const session = await sessionFor("u1", "40");
    const list = await createList("u1", { title: "Same", template: "work", deadline: null });

    const response = await callPatch(list.id, patchRequest(list.id, session.id, { title: "Same" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.history).toEqual([]);
  });

  it("allows an edit-access shared user to update the list", async () => {
    const editor = await sessionFor("u2", "41");
    const list = await createList("u1", { title: "Old", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "edit" });

    const response = await callPatch(list.id, patchRequest(list.id, editor.id, { title: "Edited by collaborator" }));

    expect(response.status).toBe(200);
  });

  it("denies a read-only shared user from updating the list", async () => {
    const viewer = await sessionFor("u2", "42");
    const list = await createList("u1", { title: "Old", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });

    const response = await callPatch(list.id, patchRequest(list.id, viewer.id, { title: "Hijacked" }));

    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/lists/[id]", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDelete(list.id, deleteRequest(list.id, undefined));

    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown list id", async () => {
    const session = await sessionFor("u1", "50");

    const response = await callDelete("does-not-exist", deleteRequest("does-not-exist", session.id));

    expect(response.status).toBe(404);
  });

  it("returns 404 instead of 403 for a private list the caller cannot view", async () => {
    const stranger = await sessionFor("u2", "51");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDelete(list.id, deleteRequest(list.id, stranger.id));

    expect(response.status).toBe(404);
    expect((await findListById(list.id))?.deletedAt).toBeNull();
  });

  it("returns 403 for an edit-access shared user", async () => {
    const editor = await sessionFor("u2", "52");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "edit" });

    const response = await callDelete(list.id, deleteRequest(list.id, editor.id));

    expect(response.status).toBe(403);
  });

  it("returns 403 for a read-only shared user", async () => {
    const viewer = await sessionFor("u2", "52b");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "read" });

    const response = await callDelete(list.id, deleteRequest(list.id, viewer.id));

    expect(response.status).toBe(403);
  });

  it("returns 200 and sets deletedAt for the owner", async () => {
    const session = await sessionFor("u1", "53");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDelete(list.id, deleteRequest(list.id, session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.deletedAt).not.toBeNull();
  });

  it("keeps the physical record in storage after deletion", async () => {
    const session = await sessionFor("u1", "54");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    await callDelete(list.id, deleteRequest(list.id, session.id));

    expect(await findListById(list.id)).toBeDefined();
  });

  it("records a history entry describing the deletion", async () => {
    const session = await sessionFor("u1", "55");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callDelete(list.id, deleteRequest(list.id, session.id));

    const json = await response.json();
    expect(json.data.history).toHaveLength(1);
    expect(json.data.history[0]).toMatchObject({ field: "deletedAt", old: null });
  });

  it("is idempotent when deleting an already-deleted list", async () => {
    const session = await sessionFor("u1", "56");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const first = await callDelete(list.id, deleteRequest(list.id, session.id));
    const firstJson = await first.json();
    const second = await callDelete(list.id, deleteRequest(list.id, session.id));
    const secondJson = await second.json();

    expect(second.status).toBe(200);
    expect(secondJson.data.deletedAt).toBe(firstJson.data.deletedAt);
    expect(secondJson.data.history).toHaveLength(1);
  });

  it("removes the deleted list from the owner's visible lists", async () => {
    const session = await sessionFor("u1", "57");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    await callDelete(list.id, deleteRequest(list.id, session.id));

    const visible = selectVisibleLists([(await findListById(list.id))!], "u1");
    expect(visible).toEqual([]);
  });

  it("removes the deleted list from Smart Archive candidates even when its last activity is stale", async () => {
    const session = await sessionFor("u1", "58");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    const now = new Date("2026-09-18T14:00:00.000Z");
    const staleActivityAt = "2026-08-01T00:00:00.000Z";
    (await getDb()).activityLog[`a-route-delete-${list.id}`] = {
      id: `a-route-delete-${list.id}`,
      entityType: "list",
      entityId: list.id,
      action: "created",
      at: staleActivityAt,
      byUserId: "u1",
    };

    const beforeDelete = await getArchiveCandidates("u1", now);
    expect(beforeDelete.some((candidate) => candidate.id === list.id)).toBe(true);

    await callDelete(list.id, deleteRequest(list.id, session.id));

    const afterDelete = await getArchiveCandidates("u1", now);
    expect(afterDelete.some((candidate) => candidate.id === list.id)).toBe(false);
  });
});
