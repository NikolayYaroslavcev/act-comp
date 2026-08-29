import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logoutAll } from "@/app/api/auth/logout-all/route";
import { GET as getSessions } from "@/app/api/auth/sessions/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";

async function loginAndGetSession() {
  const response = await login(
    new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "Admin123!" }),
    }),
  );
  const json = await response.json();
  return { sessionId: json.data.session.id as string, userId: json.data.user.id as string };
}

function sessionsRequest(sessionId?: string) {
  return new NextRequest("http://localhost/api/auth/sessions", {
    method: "GET",
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

describe("GET /api/auth/sessions", () => {
  it("returns the current user's sessions, including the current one", async () => {
    const { sessionId } = await loginAndGetSession();

    const response = await getSessions(sessionsRequest(sessionId));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.sessions.some((s: { id: string }) => s.id === sessionId)).toBe(true);
  });

  it("includes active sessions", async () => {
    const { sessionId, userId } = await loginAndGetSession();
    const active = createSession({
      userId,
      ip: "192.0.2.40 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    const response = await getSessions(sessionsRequest(sessionId));
    const json = await response.json();

    const found = json.data.sessions.find((s: { id: string }) => s.id === active.id);
    expect(found).toBeTruthy();
    expect(found.revokedAt).toBeNull();
  });

  it("includes revoked sessions", async () => {
    const { sessionId, userId } = await loginAndGetSession();
    const otherSession = createSession({
      userId,
      ip: "192.0.2.41 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });
    await logoutAll(
      new NextRequest("http://localhost/api/auth/logout-all", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` },
      }),
    );

    const { sessionId: newSessionId } = await loginAndGetSession();
    const response = await getSessions(sessionsRequest(newSessionId));
    const json = await response.json();

    const found = json.data.sessions.find((s: { id: string }) => s.id === otherSession.id);
    expect(found).toBeTruthy();
    expect(found.revokedAt).toBeTruthy();
  });

  it("returns sessions ordered from newest to oldest", async () => {
    const { sessionId, userId } = await loginAndGetSession();
    const newer = createSession({
      userId,
      ip: "192.0.2.42 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    const response = await getSessions(sessionsRequest(sessionId));
    const json = await response.json();

    const ids = json.data.sessions.map((s: { id: string }) => s.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(sessionId));
  });

  it("does not return sessions belonging to other users", async () => {
    const { sessionId } = await loginAndGetSession();
    const otherUserSession = createSession({
      userId: "some-other-user-sessions-test",
      ip: "192.0.2.43 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const response = await getSessions(sessionsRequest(sessionId));
    const json = await response.json();

    expect(json.data.sessions.some((s: { id: string }) => s.id === otherUserSession.id)).toBe(false);
  });

  it("does not include passwordHash or other sensitive fields", async () => {
    const { sessionId } = await loginAndGetSession();

    const response = await getSessions(sessionsRequest(sessionId));
    const json = await response.json();

    for (const session of json.data.sessions) {
      expect(session.passwordHash).toBeUndefined();
      expect(session.userId).toBeUndefined();
    }
  });

  it("marks the current session with isCurrent true and others false", async () => {
    const { sessionId, userId } = await loginAndGetSession();
    const other = createSession({
      userId,
      ip: "192.0.2.44 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    const response = await getSessions(sessionsRequest(sessionId));
    const json = await response.json();

    const current = json.data.sessions.find((s: { id: string }) => s.id === sessionId);
    const otherEntry = json.data.sessions.find((s: { id: string }) => s.id === other.id);
    expect(current.isCurrent).toBe(true);
    expect(otherEntry.isCurrent).toBe(false);
  });

  it("returns 401 when no cookie is present", async () => {
    const response = await getSessions(sessionsRequest());
    expect(response.status).toBe(401);
  });

  it("returns 401 for an unknown session id", async () => {
    const response = await getSessions(sessionsRequest("does-not-exist"));
    expect(response.status).toBe(401);
  });

  it("returns 401 when the current session is revoked", async () => {
    const { sessionId } = await loginAndGetSession();
    await logoutAll(
      new NextRequest("http://localhost/api/auth/logout-all", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` },
      }),
    );

    const response = await getSessions(sessionsRequest(sessionId));
    expect(response.status).toBe(401);
  });
});
