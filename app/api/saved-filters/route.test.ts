import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { getDb } from "@/shared/lib/db";
import { EMPTY_TASK_FILTER_CRITERIA } from "@/entities/saved-filter/query-schema";

function savedFiltersRequest(sessionId?: string, query = "") {
  return new NextRequest(`http://localhost/api/saved-filters${query}`, {
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

function postSavedFiltersRequest(sessionId: string | undefined, body: unknown) {
  return new NextRequest("http://localhost/api/saved-filters", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

// The seed data only defines users u1/u2/u3 (see data.json) — reuse those
// ids rather than inventing arbitrary owner ids (mirrors app/api/tasks/route.test.ts).
function sessionFor(userId: "u1" | "u2" | "u3", suffix: string) {
  return createSession({ userId, ip: `192.0.2.${suffix} (demo)`, device: "Chrome on Windows", rememberMe: false });
}

beforeEach(() => {
  getDb().savedFilters = {};
});

describe("GET /api/saved-filters", () => {
  it("returns 401 when no session cookie is present", async () => {
    const response = await GET(savedFiltersRequest(undefined, "?scope=tasks"));
    expect(response.status).toBe(401);
  });

  it("returns 400 for an unsupported scope", async () => {
    const session = sessionFor("u1", "90");
    const response = await GET(savedFiltersRequest(session.id, "?scope=bogus"));
    expect(response.status).toBe(400);
  });

  it("returns 400 for the not-yet-implemented lists scope", async () => {
    const session = sessionFor("u1", "91");
    const response = await GET(savedFiltersRequest(session.id, "?scope=lists"));
    expect(response.status).toBe(400);
  });

  it("returns only the caller's own filters", async () => {
    const session = sessionFor("u1", "92");
    getDb().savedFilters = {
      mine: {
        id: "mine",
        userId: "u1",
        scope: "tasks",
        query: { ...EMPTY_TASK_FILTER_CRITERIA, saved: false, label: null },
        usedAt: "2026-08-01T00:00:00.000Z",
      },
      other: {
        id: "other",
        userId: "u2",
        scope: "tasks",
        query: { ...EMPTY_TASK_FILTER_CRITERIA, saved: false, label: null },
        usedAt: "2026-08-01T00:00:00.000Z",
      },
    };

    const response = await GET(savedFiltersRequest(session.id, "?scope=tasks"));
    const json = await response.json();
    const ids = [...json.data.recent, ...json.data.saved].map((f: { id: string }) => f.id);
    expect(ids).toEqual(["mine"]);
  });
});

describe("POST /api/saved-filters", () => {
  it("returns 401 when no session cookie is present", async () => {
    const response = await POST(
      postSavedFiltersRequest(undefined, { action: "apply", criteria: EMPTY_TASK_FILTER_CRITERIA }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid body", async () => {
    const session = sessionFor("u1", "93");
    const response = await POST(postSavedFiltersRequest(session.id, { action: "nonsense" }));
    expect(response.status).toBe(400);
  });

  it("applies a filter as a recent (unsaved) entry scoped to the caller", async () => {
    const session = sessionFor("u1", "94");
    const response = await POST(
      postSavedFiltersRequest(session.id, {
        action: "apply",
        criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "deploy" },
      }),
    );
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.userId).toBe("u1");
    expect(json.data.query.saved).toBe(false);
  });

  it("saves a filter with a label", async () => {
    const session = sessionFor("u1", "95");
    const response = await POST(
      postSavedFiltersRequest(session.id, { action: "save", criteria: EMPTY_TASK_FILTER_CRITERIA, label: "Mine" }),
    );
    const json = await response.json();
    expect(json.data.query).toMatchObject({ saved: true, label: "Mine" });
  });
});
