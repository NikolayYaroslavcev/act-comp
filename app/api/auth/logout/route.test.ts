import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { findSessionById } from "@/entities/session/repository";
import { getCurrentSession } from "@/features/auth/current-session";

async function loginAndGetSessionId() {
  const response = await login(
    new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "Admin123!" }),
    }),
  );
  return response.cookies.get(SESSION_COOKIE_NAME)?.value as string;
}

function logoutRequest(sessionId?: string) {
  return new NextRequest("http://localhost/api/auth/logout", {
    method: "POST",
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

describe("POST /api/auth/logout", () => {
  it("returns a success response for an active session", async () => {
    const sessionId = await loginAndGetSessionId();

    const response = await logout(logoutRequest(sessionId));

    expect(response.status).toBe(200);
  });

  it("sets revokedAt on the session", async () => {
    const sessionId = await loginAndGetSessionId();

    await logout(logoutRequest(sessionId));

    expect((await findSessionById(sessionId))?.revokedAt).toBeTruthy();
  });

  it("clears the session_id cookie on the response", async () => {
    const sessionId = await loginAndGetSessionId();

    const response = await logout(logoutRequest(sessionId));

    const cookie = response.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("");
  });

  it("returns success and does nothing when no cookie is present", async () => {
    const response = await logout(logoutRequest());

    expect(response.status).toBe(200);
  });

  it("returns success and does not throw for an unknown session id", async () => {
    const response = await logout(logoutRequest("does-not-exist"));

    expect(response.status).toBe(200);
  });

  it("is idempotent when logging out an already revoked session", async () => {
    const sessionId = await loginAndGetSessionId();

    await logout(logoutRequest(sessionId));
    const revokedAtAfterFirst = (await findSessionById(sessionId))?.revokedAt;

    const response = await logout(logoutRequest(sessionId));

    expect(response.status).toBe(200);
    expect((await findSessionById(sessionId))?.revokedAt).toBe(revokedAtAfterFirst);
  });

  it("makes getCurrentSession stop treating the session as active after logout", async () => {
    const sessionId = await loginAndGetSessionId();

    await logout(logoutRequest(sessionId));

    expect(await getCurrentSession(sessionId)).toBeNull();
  });
});
