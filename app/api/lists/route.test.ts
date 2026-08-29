import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/lists/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession, revokeSession } from "@/entities/session/repository";
import { findListById } from "@/entities/list/repository";

function listsRequest(sessionId?: string) {
  return new NextRequest("http://localhost/api/lists", {
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

function createListRequest(sessionId: string | undefined, body: unknown) {
  return new NextRequest("http://localhost/api/lists", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function createListRequestWithRawBody(sessionId: string, rawBody: string) {
  return new NextRequest("http://localhost/api/lists", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
    },
    body: rawBody,
  });
}

describe("GET /api/lists", () => {
  it("returns 401 when no session cookie is present", async () => {
    const response = await GET(listsRequest());

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.data).toBeUndefined();
  });

  it("returns 401 for an unknown session id", async () => {
    const response = await GET(listsRequest("does-not-exist"));

    expect(response.status).toBe(401);
  });

  it("returns 401 for a revoked session", async () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    revokeSession(session.id);

    const response = await GET(listsRequest(session.id));

    expect(response.status).toBe(401);
  });

  it("returns 200 with the lists for a valid active session", async () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const response = await GET(listsRequest(session.id));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json.data)).toBe(true);
  });
});

describe("POST /api/lists", () => {
  it("returns 401 when no session cookie is present", async () => {
    const response = await POST(
      createListRequest(undefined, { title: "New list", template: "work" }),
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.20 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const response = await POST(createListRequestWithRawBody(session.id, "{ not json"));

    expect(response.status).toBe(400);
  });

  it("returns 400 for a Zod validation error", async () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.21 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const response = await POST(
      createListRequest(session.id, { title: "New list", template: "hobby" }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.issues).toBeTruthy();
  });

  it("creates a list owned by the current session's user on valid input", async () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.22 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const response = await POST(
      createListRequest(session.id, { title: "New list", template: "work" }),
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.ownerId).toBe("u1");
    expect(json.data.title).toBe("New list");
    expect(json.data.template).toBe("work");
    expect(findListById(json.data.id)).toBeDefined();
  });

  it("ignores a client-supplied ownerId and uses the session's user instead", async () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.23 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const response = await POST(
      createListRequest(session.id, {
        ownerId: "someone-else",
        title: "New list",
        template: "personal",
      }),
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.ownerId).toBe("u1");
  });
});
