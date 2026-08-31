import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/notifications/route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession, revokeSession } from "@/entities/session/repository";
import { getDb, saveDb } from "@/shared/lib/db";
import { notificationKey } from "@/entities/notification/model";
import { listAckedNotificationKeys } from "@/entities/notification/repository";
import { updateUserSettings } from "@/entities/user/repository";

function notificationsRequest(method: "GET" | "PATCH", sessionId?: string, body?: unknown) {
  return new NextRequest("http://localhost/api/notifications", {
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

describe("GET /api/notifications", () => {
  it("returns 401 when no session cookie is present", async () => {
    const response = await GET(notificationsRequest("GET"));
    expect(response.status).toBe(401);
  });

  it("returns 401 for a revoked session", async () => {
    const session = sessionFor("u1", "70");
    revokeSession(session.id);

    const response = await GET(notificationsRequest("GET", session.id));
    expect(response.status).toBe(401);
  });

  it("returns only the current user's due notifications", async () => {
    const db = getDb();
    db.tasks.t8 = { ...db.tasks.t8, timeSpentMin: 23 };
    saveDb(db);

    const ownerSession = sessionFor("u1", "71");
    const otherSession = sessionFor("u3", "72");

    const ownerResponse = await GET(notificationsRequest("GET", ownerSession.id));
    const otherResponse = await GET(notificationsRequest("GET", otherSession.id));
    const ownerJson = await ownerResponse.json();
    const otherJson = await otherResponse.json();

    expect(ownerResponse.status).toBe(200);
    expect(otherResponse.status).toBe(200);
    const key = notificationKey("time_threshold", "t8", 75);
    expect(ownerJson.data.some((item: { key: string }) => item.key === key)).toBe(true);
    expect(otherJson.data.some((item: { key: string }) => item.key === key)).toBe(false);
  });

  it("delivers a workDayHours notification through the full save -> GET -> ack path", async () => {
    updateUserSettings("u1", { workDayHours: 5 });

    const ownerSession = sessionFor("u1", "78");
    const otherSession = sessionFor("u2", "79");

    const ownerResponse = await GET(notificationsRequest("GET", ownerSession.id));
    const ownerJson = await ownerResponse.json();
    const notification = ownerJson.data.find((item: { kind: string }) => item.kind === "work_day_hours_changed");
    expect(notification).toBeDefined();

    const otherResponse = await GET(notificationsRequest("GET", otherSession.id));
    const otherJson = await otherResponse.json();
    expect(otherJson.data.some((item: { kind: string }) => item.kind === "work_day_hours_changed")).toBe(false);

    const ackResponse = await PATCH(
      notificationsRequest("PATCH", ownerSession.id, { keys: [notification.key] }),
    );
    expect(ackResponse.status).toBe(200);

    const afterAck = await GET(notificationsRequest("GET", ownerSession.id));
    const afterAckJson = await afterAck.json();
    expect(afterAckJson.data.some((item: { key: string }) => item.key === notification.key)).toBe(false);
  });
});

describe("PATCH /api/notifications", () => {
  it("returns 401 when no session cookie is present", async () => {
    const response = await PATCH(notificationsRequest("PATCH", undefined, { keys: ["time_threshold:t1:75"] }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const session = sessionFor("u1", "73");
    const response = await PATCH(
      new NextRequest("http://localhost/api/notifications", {
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

  it("acks currently due keys for the current user only", async () => {
    const db = getDb();
    db.tasks.t8 = { ...db.tasks.t8, timeSpentMin: 23 };
    saveDb(db);

    const session = sessionFor("u1", "74");
    const key = notificationKey("time_threshold", "t8", 75);

    const response = await PATCH(notificationsRequest("PATCH", session.id, { keys: [key] }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toContain(key);
    expect(listAckedNotificationKeys("u1")).toContain(key);
    expect(listAckedNotificationKeys("u2")).not.toContain(key);
  });

  it("rejects an arbitrary key that is not currently due", async () => {
    const session = sessionFor("u1", "75");
    const key = "time_threshold:t-isolated:75";

    const response = await PATCH(notificationsRequest("PATCH", session.id, { keys: [key] }));

    expect(response.status).toBe(400);
    expect(listAckedNotificationKeys("u1")).not.toContain(key);
  });

  it("rejects a well-formed key for another user's task", async () => {
    const db = getDb();
    db.tasks.t8 = { ...db.tasks.t8, timeSpentMin: 23 };
    saveDb(db);

    const session = sessionFor("u3", "76");
    const key = notificationKey("time_threshold", "t8", 75);

    const response = await PATCH(notificationsRequest("PATCH", session.id, { keys: [key] }));

    expect(response.status).toBe(400);
    expect(listAckedNotificationKeys("u3")).not.toContain(key);
  });

  it("rejects a malformed notification key", async () => {
    const session = sessionFor("u1", "77");

    const response = await PATCH(notificationsRequest("PATCH", session.id, { keys: ["not-a-notification"] }));

    expect(response.status).toBe(400);
    expect(listAckedNotificationKeys("u1")).not.toContain("not-a-notification");
  });
});
