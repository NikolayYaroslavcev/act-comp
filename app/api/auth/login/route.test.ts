import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/login/route";
import { findSessionById } from "@/entities/session/repository";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { getCurrentSession } from "@/features/auth/current-session";

function loginRequest(body: unknown, userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0") {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": userAgent },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("returns 200 and a session for valid admin credentials", async () => {
    const response = await POST(
      loginRequest({ email: "admin@example.com", password: "Admin123!" }),
    );
    const json = await response.json();
    const sessionId = response.cookies.get(SESSION_COOKIE_NAME)?.value;

    expect(response.status).toBe(200);
    expect(json.data.user.email).toBe("admin@example.com");
    expect(json.data.user.passwordHash).toBeUndefined();
    expect(json.data.session).toBeUndefined();
    expect(sessionId).toBeTruthy();
    expect(findSessionById(sessionId!)?.userId).toBe(json.data.user.id);
  });

  it("returns 401 for a wrong password", async () => {
    const response = await POST(
      loginRequest({ email: "admin@example.com", password: "wrong-password" }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 for an unknown email", async () => {
    const response = await POST(
      loginRequest({ email: "nobody@example.com", password: "Admin123!" }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid email", async () => {
    const response = await POST(loginRequest({ email: "not-an-email", password: "Admin123!" }));
    expect(response.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await POST(loginRequest({ email: "admin@example.com" }));
    expect(response.status).toBe(400);
  });

  it("persists the created session via the repository", async () => {
    const response = await POST(
      loginRequest({ email: "admin@example.com", password: "Admin123!" }),
    );
    const sessionId = response.cookies.get(SESSION_COOKIE_NAME)?.value;

    expect(findSessionById(sessionId!)).toBeDefined();
  });

  it("stores the requested rememberMe value on the session", async () => {
    const response = await POST(
      loginRequest({ email: "admin@example.com", password: "Admin123!", rememberMe: true }),
    );
    const sessionId = response.cookies.get(SESSION_COOKIE_NAME)?.value;

    expect(findSessionById(sessionId!)?.rememberMe).toBe(true);
  });

  it("creates a new session with revokedAt set to null", async () => {
    const response = await POST(
      loginRequest({ email: "admin@example.com", password: "Admin123!" }),
    );
    const sessionId = response.cookies.get(SESSION_COOKIE_NAME)?.value;

    expect(findSessionById(sessionId!)?.revokedAt).toBeNull();
  });

  it("determines device from the User-Agent header", async () => {
    const response = await POST(
      loginRequest(
        { email: "admin@example.com", password: "Admin123!" },
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15",
      ),
    );
    const sessionId = response.cookies.get(SESSION_COOKIE_NAME)?.value;

    expect(findSessionById(sessionId!)?.device).toBe("Safari on macOS");
  });

  it("lets the httpOnly cookie authenticate a subsequent request", async () => {
    const response = await POST(
      loginRequest({ email: "admin@example.com", password: "Admin123!" }),
    );
    const sessionId = response.cookies.get(SESSION_COOKIE_NAME)?.value;

    expect(getCurrentSession(sessionId)).not.toBeNull();
  });
});
