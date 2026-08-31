import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/lists/[id]/share/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { createList, findListById } from "@/entities/list/repository";

function shareRequest(id: string, sessionId: string | undefined, body?: unknown) {
  return new NextRequest(`http://localhost/api/lists/${id}/share`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
}

function shareRequestWithRawBody(id: string, sessionId: string, rawBody: string) {
  return new NextRequest(`http://localhost/api/lists/${id}/share`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
    },
    body: rawBody,
  });
}

async function callShare(id: string, request: NextRequest) {
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

describe("POST /api/lists/[id]/share", () => {
  it("returns 401 when no session cookie is present", async () => {
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callShare(list.id, shareRequest(list.id, undefined, { userId: "u2", access: "read" }));

    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown list id", async () => {
    const session = await sessionFor("u1", "60");

    const response = await callShare(
      "does-not-exist",
      shareRequest("does-not-exist", session.id, { userId: "u2", access: "read" }),
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when the caller does not own the list", async () => {
    const stranger = await sessionFor("u3", "61");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callShare(list.id, shareRequest(list.id, stranger.id, { userId: "u2", access: "read" }));

    expect(response.status).toBe(404);
  });

  it("returns 403 for an edit-access collaborator (only the owner manages sharing)", async () => {
    const collaboratorSession = await sessionFor("u2", "62");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.sharedWith.push({ userId: "u2", access: "edit" });

    const response = await callShare(
      list.id,
      shareRequest(list.id, collaboratorSession.id, { userId: "u3", access: "read" }),
    );

    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid JSON", async () => {
    const session = await sessionFor("u1", "63");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callShare(list.id, shareRequestWithRawBody(list.id, session.id, "{not-json"));

    expect(response.status).toBe(400);
  });

  it("returns 400 when neither userId nor email is provided", async () => {
    const session = await sessionFor("u1", "64");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callShare(list.id, shareRequest(list.id, session.id, { access: "read" }));

    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid access value", async () => {
    const session = await sessionFor("u1", "65");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callShare(list.id, shareRequest(list.id, session.id, { userId: "u2", access: "admin" }));

    expect(response.status).toBe(400);
  });

  it("returns 400 when the target user does not exist, without revealing that they are missing", async () => {
    const session = await sessionFor("u1", "66");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callShare(
      list.id,
      shareRequest(list.id, session.id, { userId: "does-not-exist", access: "read" }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.message).toBe("Unable to share this list with the specified user");
  });

  it("returns 400 when the owner tries to share the list with themselves", async () => {
    const session = await sessionFor("u1", "67");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callShare(list.id, shareRequest(list.id, session.id, { userId: "u1", access: "read" }));

    expect(response.status).toBe(400);
  });

  it("returns 200 and the updated list for a valid share by the owner", async () => {
    const session = await sessionFor("u1", "68");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callShare(list.id, shareRequest(list.id, session.id, { userId: "u2", access: "read" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.sharedWith).toEqual([{ userId: "u2", access: "read" }]);
  });

  it("resolves the target user by email", async () => {
    const session = await sessionFor("u1", "69");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callShare(
      list.id,
      shareRequest(list.id, session.id, { email: "user@example.com", access: "edit" }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.sharedWith).toEqual([{ userId: "u2", access: "edit" }]);
  });

  it("cannot be used to spoof the owner via the request body", async () => {
    const session = await sessionFor("u1", "70");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    const response = await callShare(
      list.id,
      shareRequest(list.id, session.id, { userId: "u2", access: "read", ownerId: "u3" }),
    );

    expect(response.status).toBe(200);
    expect((await findListById(list.id))?.ownerId).toBe("u1");
  });

  it("returns 404 for a soft-deleted list", async () => {
    const session = await sessionFor("u1", "71");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });
    (await findListById(list.id))!.deletedAt = new Date().toISOString();

    const response = await callShare(list.id, shareRequest(list.id, session.id, { userId: "u2", access: "read" }));

    expect(response.status).toBe(404);
  });

  it("updates access on a repeated share call instead of duplicating the entry", async () => {
    const session = await sessionFor("u1", "72");
    const list = await createList("u1", { title: "Owned", template: "work", deadline: null });

    await callShare(list.id, shareRequest(list.id, session.id, { userId: "u2", access: "read" }));
    const response = await callShare(list.id, shareRequest(list.id, session.id, { userId: "u2", access: "edit" }));

    const json = await response.json();
    expect(json.data.sharedWith).toEqual([{ userId: "u2", access: "edit" }]);
  });
});
