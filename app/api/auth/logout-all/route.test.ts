import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logoutAll } from "@/app/api/auth/logout-all/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession, findSessionById } from "@/entities/session/repository";
import { getCurrentSession } from "@/features/auth/current-session";

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

function logoutAllRequest(sessionId?: string) {
  return new NextRequest("http://localhost/api/auth/logout-all", {
    method: "POST",
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

describe("POST /api/auth/logout-all", () => {
  it("returns a success response for an active session", async () => {
    const { sessionId } = await loginAndGetSession();

    const response = await logoutAll(logoutAllRequest(sessionId));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.success).toBe(true);
  });

  it("revokes all active sessions of the current user", async () => {
    const { sessionId, userId } = await loginAndGetSession();
    const otherOwnSession = createSession({
      userId,
      ip: "192.0.2.20 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    await logoutAll(logoutAllRequest(sessionId));

    expect(findSessionById(sessionId)?.revokedAt).toBeTruthy();
    expect(findSessionById(otherOwnSession.id)?.revokedAt).toBeTruthy();
  });

  it("does not change an already revoked session of the same user", async () => {
    const { sessionId, userId } = await loginAndGetSession();
    const alreadyRevokedSession = createSession({
      userId,
      ip: "192.0.2.21 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });
    await logoutAll(logoutAllRequest(alreadyRevokedSession.id));
    const revokedAtBefore = findSessionById(alreadyRevokedSession.id)?.revokedAt;

    await logoutAll(logoutAllRequest(sessionId));

    expect(findSessionById(alreadyRevokedSession.id)?.revokedAt).toBe(revokedAtBefore);
  });

  it("does not affect sessions of other users", async () => {
    const { sessionId } = await loginAndGetSession();
    const otherUserSession = createSession({
      userId: "some-other-user",
      ip: "192.0.2.22 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    await logoutAll(logoutAllRequest(sessionId));

    expect(findSessionById(otherUserSession.id)?.revokedAt).toBeNull();
  });

  it("clears the session_id cookie on the response", async () => {
    const { sessionId } = await loginAndGetSession();

    const response = await logoutAll(logoutAllRequest(sessionId));

    const cookie = response.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("");
  });

  it("makes getCurrentSession stop treating the current session as active", async () => {
    const { sessionId } = await loginAndGetSession();

    await logoutAll(logoutAllRequest(sessionId));

    expect(getCurrentSession(sessionId)).toBeNull();
  });

  it("makes another active session of the same user inactive", async () => {
    const { sessionId, userId } = await loginAndGetSession();
    const otherOwnSession = createSession({
      userId,
      ip: "192.0.2.23 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    await logoutAll(logoutAllRequest(sessionId));

    expect(getCurrentSession(otherOwnSession.id)).toBeNull();
  });

  it("returns 401 when no cookie is present", async () => {
    const response = await logoutAll(logoutAllRequest());
    expect(response.status).toBe(401);
  });

  it("returns 401 for an unknown session id", async () => {
    const response = await logoutAll(logoutAllRequest("does-not-exist"));
    expect(response.status).toBe(401);
  });

  it("returns 401 when the current session is already revoked", async () => {
    const { sessionId } = await loginAndGetSession();
    await logoutAll(logoutAllRequest(sessionId));

    const response = await logoutAll(logoutAllRequest(sessionId));

    expect(response.status).toBe(401);
  });
});
