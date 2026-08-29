import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { requireAuth } from "@/features/auth/require-auth";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession, revokeSession } from "@/entities/session/repository";

function requestWithSession(sessionId?: string) {
  return new NextRequest("http://localhost/api/protected", {
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

describe("requireAuth", () => {
  it("authorizes a request with a valid active session", () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const result = requireAuth(requestWithSession(session.id));

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.session.id).toBe(session.id);
      expect(result.user.id).toBe("u1");
      expect("passwordHash" in result.user).toBe(false);
    }
  });

  it("rejects a request with no session cookie", () => {
    expect(requireAuth(requestWithSession())).toEqual({ authorized: false });
  });

  it("rejects a request with an unknown session id", () => {
    expect(requireAuth(requestWithSession("does-not-exist"))).toEqual({ authorized: false });
  });

  it("rejects a request with a revoked session", () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    revokeSession(session.id);

    expect(requireAuth(requestWithSession(session.id))).toEqual({ authorized: false });
  });
});
