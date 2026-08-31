import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession } from "@/entities/session/repository";
import { getDb } from "@/shared/lib/db";
import { EMPTY_TASK_FILTER_CRITERIA } from "@/entities/saved-filter/query-schema";
import { EMPTY_LIST_FILTER_CRITERIA } from "@/entities/saved-filter/list-query-schema";

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
async function sessionFor(userId: "u1" | "u2" | "u3", suffix: string) {
  return await createSession({ userId, ip: `192.0.2.${suffix} (demo)`, device: "Chrome on Windows", rememberMe: false });
}

beforeEach(async () => {
  (await getDb()).savedFilters = {};
});

describe("GET /api/saved-filters", () => {
  it("returns 401 when no session cookie is present", async () => {
    const response = await GET(savedFiltersRequest(undefined, "?scope=tasks"));
    expect(response.status).toBe(401);
  });

  it("returns 400 for an unsupported scope", async () => {
    const session = await sessionFor("u1", "90");
    const response = await GET(savedFiltersRequest(session.id, "?scope=bogus"));
    expect(response.status).toBe(400);
  });

  it("supports the lists scope, returning only that scope's saved filters", async () => {
    const session = await sessionFor("u1", "91");
    (await getDb()).savedFilters = {
      taskFilter: {
        id: "taskFilter",
        userId: "u1",
        scope: "tasks",
        query: { ...EMPTY_TASK_FILTER_CRITERIA, saved: false, label: null },
        usedAt: "2026-08-01T00:00:00.000Z",
      },
      listFilter: {
        id: "listFilter",
        userId: "u1",
        scope: "lists",
        query: { ...EMPTY_LIST_FILTER_CRITERIA, saved: false, label: null },
        usedAt: "2026-08-01T00:00:00.000Z",
      },
    };

    const response = await GET(savedFiltersRequest(session.id, "?scope=lists"));
    expect(response.status).toBe(200);
    const json = await response.json();
    const ids = [...json.data.recent, ...json.data.saved].map((f: { id: string }) => f.id);
    expect(ids).toEqual(["listFilter"]);
  });

  it("returns only the caller's own filters", async () => {
    const session = await sessionFor("u1", "92");
    (await getDb()).savedFilters = {
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
    const session = await sessionFor("u1", "93");
    const response = await POST(postSavedFiltersRequest(session.id, { action: "nonsense" }));
    expect(response.status).toBe(400);
  });

  it("applies a filter as a recent (unsaved) entry scoped to the caller", async () => {
    const session = await sessionFor("u1", "94");
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
    const session = await sessionFor("u1", "95");
    const response = await POST(
      postSavedFiltersRequest(session.id, { action: "save", criteria: EMPTY_TASK_FILTER_CRITERIA, label: "Mine" }),
    );
    const json = await response.json();
    expect(json.data.query).toMatchObject({ saved: true, label: "Mine" });
  });

  it("applies a list filter under the lists scope when scope is provided", async () => {
    const session = await sessionFor("u1", "95a");
    const response = await POST(
      postSavedFiltersRequest(session.id, {
        action: "apply",
        scope: "lists",
        criteria: { ...EMPTY_LIST_FILTER_CRITERIA, search: "sprint" },
      }),
    );
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.scope).toBe("lists");
    expect(json.data.query).toMatchObject({ search: "sprint", saved: false });
  });

  it("saves a list filter with a label under the lists scope", async () => {
    const session = await sessionFor("u1", "95b");
    const response = await POST(
      postSavedFiltersRequest(session.id, {
        action: "save",
        scope: "lists",
        criteria: { ...EMPTY_LIST_FILTER_CRITERIA, template: ["work"] },
        label: "My lists",
      }),
    );
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.scope).toBe("lists");
    expect(json.data.query).toMatchObject({ template: ["work"], saved: true, label: "My lists" });
  });

  it("rejects list-scoped criteria that do not match the list filter shape", async () => {
    const session = await sessionFor("u1", "95c");
    const response = await POST(
      postSavedFiltersRequest(session.id, {
        action: "apply",
        scope: "lists",
        criteria: EMPTY_TASK_FILTER_CRITERIA,
      }),
    );
    expect(response.status).toBe(400);
  });

  it("defaults to the tasks scope when scope is omitted, preserving prior behaviour", async () => {
    const session = await sessionFor("u1", "95d");
    const response = await POST(
      postSavedFiltersRequest(session.id, { action: "apply", criteria: EMPTY_TASK_FILTER_CRITERIA }),
    );
    const json = await response.json();
    expect(json.data.scope).toBe("tasks");
  });

  describe("touch action", () => {
    it("updates usedAt on the caller's own filter and returns 200", async () => {
      const session = await sessionFor("u1", "96");
      (await getDb()).savedFilters = {
        mine: {
          id: "mine",
          userId: "u1",
          scope: "tasks",
          query: { ...EMPTY_TASK_FILTER_CRITERIA, saved: false, label: null },
          usedAt: "2020-01-01T00:00:00.000Z",
        },
      };

      const response = await POST(postSavedFiltersRequest(session.id, { action: "touch", id: "mine" }));
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.usedAt).not.toBe("2020-01-01T00:00:00.000Z");
    });

    it("returns 404 for a filter owned by another user", async () => {
      const session = await sessionFor("u2", "97");
      (await getDb()).savedFilters = {
        mine: {
          id: "mine",
          userId: "u1",
          scope: "tasks",
          query: { ...EMPTY_TASK_FILTER_CRITERIA, saved: false, label: null },
          usedAt: "2020-01-01T00:00:00.000Z",
        },
      };

      const response = await POST(postSavedFiltersRequest(session.id, { action: "touch", id: "mine" }));
      expect(response.status).toBe(404);
    });

    it("returns 404 for a missing id", async () => {
      const session = await sessionFor("u1", "98");
      const response = await POST(postSavedFiltersRequest(session.id, { action: "touch", id: "missing" }));
      expect(response.status).toBe(404);
    });

    it("returns 401 when no session cookie is present, before body parsing", async () => {
      const response = await POST(postSavedFiltersRequest(undefined, { action: "touch", id: "mine" }));
      expect(response.status).toBe(401);
    });
  });
});
