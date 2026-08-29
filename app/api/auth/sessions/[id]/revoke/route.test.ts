import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as revoke } from "@/app/api/auth/sessions/[id]/revoke/route";
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

function revokeRequest(targetId: string, cookieSessionId?: string) {
  return {
    request: new NextRequest(`http://localhost/api/auth/sessions/${targetId}/revoke`, {
      method: "POST",
      headers: cookieSessionId ? { cookie: `${SESSION_COOKIE_NAME}=${cookieSessionId}` } : {},
    }),
    context: { params: Promise.resolve({ id: targetId }) },
  };
}

describe("POST /api/auth/sessions/[id]/revoke", () => {
  it("revokes another active session of the current user", async () => {
    const { sessionId, userId } = await loginAndGetSession();
    const other = createSession({
      userId,
      ip: "192.0.2.70 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    const { request, context } = revokeRequest(other.id, sessionId);
    const response = await revoke(request, context);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.success).toBe(true);
    expect(findSessionById(other.id)?.revokedAt).toBeTruthy();
  });

  it("makes the target session inactive after revoke", async () => {
    const { sessionId, userId } = await loginAndGetSession();
    const other = createSession({
      userId,
      ip: "192.0.2.71 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    const { request, context } = revokeRequest(other.id, sessionId);
    await revoke(request, context);

    expect(getCurrentSession(other.id)).toBeNull();
  });

  it("does not change the current session cookie when revoking another session", async () => {
    const { sessionId, userId } = await loginAndGetSession();
    const other = createSession({
      userId,
      ip: "192.0.2.72 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    const { request, context } = revokeRequest(other.id, sessionId);
    const response = await revoke(request, context);

    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
    expect(getCurrentSession(sessionId)).not.toBeNull();
  });

  it("revokes the current session when targeted", async () => {
    const { sessionId } = await loginAndGetSession();

    const { request, context } = revokeRequest(sessionId, sessionId);
    const response = await revoke(request, context);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.success).toBe(true);
    expect(findSessionById(sessionId)?.revokedAt).toBeTruthy();
  });

  it("clears the session_id cookie when revoking the current session", async () => {
    const { sessionId } = await loginAndGetSession();

    const { request, context } = revokeRequest(sessionId, sessionId);
    const response = await revoke(request, context);

    const cookie = response.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("");
  });

  it("makes getCurrentSession return null after revoking the current session", async () => {
    const { sessionId } = await loginAndGetSession();

    const { request, context } = revokeRequest(sessionId, sessionId);
    await revoke(request, context);

    expect(getCurrentSession(sessionId)).toBeNull();
  });

  it("returns 401 when no cookie is present", async () => {
    const { request, context } = revokeRequest("does-not-exist");
    const response = await revoke(request, context);

    expect(response.status).toBe(401);
  });

  it("returns 401 for an unknown auth session id", async () => {
    const { request, context } = revokeRequest("does-not-exist", "does-not-exist");
    const response = await revoke(request, context);

    expect(response.status).toBe(401);
  });

  it("returns 401 when the current session is revoked", async () => {
    const { sessionId } = await loginAndGetSession();
    const { request: firstRequest, context: firstContext } = revokeRequest(sessionId, sessionId);
    await revoke(firstRequest, firstContext);

    const { request, context } = revokeRequest(sessionId, sessionId);
    const response = await revoke(request, context);

    expect(response.status).toBe(401);
  });

  it("does not reveal that a target session belongs to another user", async () => {
    const { sessionId } = await loginAndGetSession();
    const otherUserSession = createSession({
      userId: "some-other-user-revoke-test",
      ip: "192.0.2.73 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const { request, context } = revokeRequest(otherUserSession.id, sessionId);
    const response = await revoke(request, context);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.success).toBe(true);
    expect(findSessionById(otherUserSession.id)?.revokedAt).toBeNull();
  });

  it("does not reveal that a target session is unknown", async () => {
    const { sessionId } = await loginAndGetSession();

    const { request, context } = revokeRequest("does-not-exist-target", sessionId);
    const response = await revoke(request, context);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.success).toBe(true);
  });

  it("does not return session, user, or other extra data", async () => {
    const { sessionId, userId } = await loginAndGetSession();
    const other = createSession({
      userId,
      ip: "192.0.2.74 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    const { request, context } = revokeRequest(other.id, sessionId);
    const response = await revoke(request, context);
    const json = await response.json();

    expect(Object.keys(json.data)).toEqual(["success"]);
  });
});
