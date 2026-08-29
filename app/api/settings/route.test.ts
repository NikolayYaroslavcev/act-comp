import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/settings/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession, revokeSession } from "@/entities/session/repository";
import { findUserById } from "@/entities/user/repository";

function settingsRequest(method: "GET" | "PATCH", sessionId?: string, body?: unknown) {
  return new NextRequest("http://localhost/api/settings", {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function sessionFor(userId: "u1" | "u2" | "u3", suffix: string) {
  return createSession({
    userId,
    ip: `192.0.2.${suffix} (demo)`,
    device: "Chrome on Windows",
    rememberMe: false,
  });
}

describe("GET /api/settings", () => {
  it("returns 401 when no session cookie is present", async () => {
    const response = await GET(settingsRequest("GET"));
    expect(response.status).toBe(401);
  });

  it("returns 401 for a revoked session", async () => {
    const session = sessionFor("u1", "10");
    revokeSession(session.id);

    const response = await GET(settingsRequest("GET", session.id));
    expect(response.status).toBe(401);
  });

  it("returns the current user's settings only", async () => {
    const session = sessionFor("u2", "11");

    const response = await GET(settingsRequest("GET", session.id));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual(findUserById("u2")!.settings);
    expect(json.data).not.toEqual(findUserById("u1")!.settings);
  });
});

describe("PATCH /api/settings", () => {
  it("returns 401 when no session cookie is present", async () => {
    const response = await PATCH(settingsRequest("PATCH", undefined, { theme: "dark" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const session = sessionFor("u1", "20");
    const response = await PATCH(
      new NextRequest("http://localhost/api/settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${session.id}`,
        },
        body: "{ not json",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid field value", async () => {
    const session = sessionFor("u1", "21");
    const response = await PATCH(settingsRequest("PATCH", session.id, { theme: "neon" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.issues).toBeTruthy();
  });

  it("returns 400 for a spoofed userId field", async () => {
    const session = sessionFor("u1", "22");
    const response = await PATCH(
      settingsRequest("PATCH", session.id, { theme: "dark", userId: "u2" }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 200 and applies a partial update without resetting other fields", async () => {
    const session = sessionFor("u3", "23");
    const before = findUserById("u3")!.settings;

    const response = await PATCH(settingsRequest("PATCH", session.id, { theme: "light" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.theme).toBe("light");
    expect(json.data.workDayHours).toBe(before.workDayHours);
    expect(json.data.notifications).toEqual(before.notifications);
    expect(json.data.taskDefaults).toEqual(before.taskDefaults);
    expect(findUserById("u3")!.settings.theme).toBe("light");
  });

  it("cannot change another user's settings by sending their userId", async () => {
    const session = sessionFor("u1", "24");
    const u2Before = findUserById("u2")!.settings;

    await PATCH(settingsRequest("PATCH", session.id, { userId: "u2", theme: "dark" }));

    expect(findUserById("u2")!.settings).toEqual(u2Before);
  });
});
