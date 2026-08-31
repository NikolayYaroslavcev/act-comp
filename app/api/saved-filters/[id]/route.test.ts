import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "./route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { getDb } from "@/shared/lib/db";
import { EMPTY_TASK_FILTER_CRITERIA } from "@/entities/saved-filter/query-schema";

function deleteRequest(sessionId?: string) {
  return new NextRequest("http://localhost/api/saved-filters/f1", {
    method: "DELETE",
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

async function sessionFor(userId: "u1" | "u2" | "u3", suffix: string) {
  return await createSession({ userId, ip: `192.0.2.${suffix} (demo)`, device: "Chrome on Windows", rememberMe: false });
}

async function seedFilter(id: string, userId: string) {
  (await getDb()).savedFilters[id] = {
    id,
    userId,
    scope: "tasks",
    query: { ...EMPTY_TASK_FILTER_CRITERIA, saved: true, label: null },
    usedAt: "2026-08-01T00:00:00.000Z",
  };
}

beforeEach(async () => {
  (await getDb()).savedFilters = {};
});

describe("DELETE /api/saved-filters/:id", () => {
  it("returns 401 without auth", async () => {
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: "f1" }) });
    expect(response.status).toBe(401);
  });

  it("deletes the caller's own filter", async () => {
    const session = await sessionFor("u1", "96");
    await seedFilter("f1", "u1");

    const response = await DELETE(deleteRequest(session.id), { params: Promise.resolve({ id: "f1" }) });

    expect(response.status).toBe(200);
    expect((await getDb()).savedFilters.f1).toBeUndefined();
  });

  it("returns 404 for another user's filter and does not delete it", async () => {
    const session = await sessionFor("u1", "97");
    await seedFilter("f1", "u2");

    const response = await DELETE(deleteRequest(session.id), { params: Promise.resolve({ id: "f1" }) });

    expect(response.status).toBe(404);
    expect((await getDb()).savedFilters.f1).toBeDefined();
  });

  it("returns 404 for a missing id", async () => {
    const session = await sessionFor("u1", "98");

    const response = await DELETE(deleteRequest(session.id), { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
  });
});
