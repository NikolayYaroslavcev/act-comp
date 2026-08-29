import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/shared/lib/db";
import { deleteSavedFilter, listSavedFilters, upsertAppliedFilter, type UpsertFilterInput } from "./repository";
import { EMPTY_TASK_FILTER_CRITERIA, parseSavedFilterQuery } from "./query-schema";

function baseInput(overrides: Partial<UpsertFilterInput> = {}): UpsertFilterInput {
  return {
    userId: "u1",
    scope: "tasks",
    criteria: EMPTY_TASK_FILTER_CRITERIA,
    saved: false,
    label: null,
    ...overrides,
  };
}

beforeEach(() => {
  const db = getDb();
  db.savedFilters = {};
});

describe("upsertAppliedFilter", () => {
  it("creates a new recent filter", () => {
    const created = upsertAppliedFilter(baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "deploy" } }));
    expect(created.userId).toBe("u1");
    expect(created.scope).toBe("tasks");
    expect(parseSavedFilterQuery(created)).toMatchObject({ search: "deploy", saved: false });
  });

  it("updates usedAt instead of creating a duplicate for an equivalent recent filter", () => {
    const first = upsertAppliedFilter(baseInput(), new Date("2026-08-01T00:00:00.000Z"));
    const second = upsertAppliedFilter(baseInput(), new Date("2026-08-02T00:00:00.000Z"));

    expect(second.id).toBe(first.id);
    expect(second.usedAt).toBe("2026-08-02T00:00:00.000Z");
    expect(listSavedFilters("u1", "tasks")).toHaveLength(1);
  });

  it("does not treat reordered status/tags arrays as a different filter", () => {
    upsertAppliedFilter(baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, status: ["done", "new"] } }));
    upsertAppliedFilter(baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, status: ["new", "done"] } }));

    expect(listSavedFilters("u1", "tasks")).toHaveLength(1);
  });

  it("caps recent (unsaved) filters at 5 per user+scope, evicting the oldest", () => {
    for (let i = 0; i < 6; i += 1) {
      upsertAppliedFilter(
        baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: `q${i}` } }),
        new Date(2026, 7, i + 1),
      );
    }

    const recent = listSavedFilters("u1", "tasks");
    expect(recent).toHaveLength(5);
    expect(recent.every((filter) => parseSavedFilterQuery(filter).search !== "q0")).toBe(true);
  });

  it("does not let saved filters count against the recent cap", () => {
    upsertAppliedFilter(baseInput({ saved: true, criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "pinned" } }));
    for (let i = 0; i < 5; i += 1) {
      upsertAppliedFilter(
        baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: `q${i}` } }),
        new Date(2026, 7, i + 1),
      );
    }

    const all = listSavedFilters("u1", "tasks");
    expect(all).toHaveLength(6);
    expect(all.some((filter) => parseSavedFilterQuery(filter).search === "pinned")).toBe(true);
  });

  it("keeps a saved filter and a recent filter with identical criteria as two separate records", () => {
    const criteria = { ...EMPTY_TASK_FILTER_CRITERIA, search: "shared" };
    upsertAppliedFilter(baseInput({ criteria, saved: false }));
    upsertAppliedFilter(baseInput({ criteria, saved: true }));

    expect(listSavedFilters("u1", "tasks")).toHaveLength(2);
  });

  it("scopes filters per user", () => {
    upsertAppliedFilter(baseInput({ userId: "u1" }));
    upsertAppliedFilter(baseInput({ userId: "u2" }));

    expect(listSavedFilters("u1", "tasks")).toHaveLength(1);
    expect(listSavedFilters("u2", "tasks")).toHaveLength(1);
  });

  it("sorts filters by usedAt descending", () => {
    upsertAppliedFilter(
      baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "old" } }),
      new Date("2026-08-01T00:00:00.000Z"),
    );
    upsertAppliedFilter(
      baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "new" } }),
      new Date("2026-08-05T00:00:00.000Z"),
    );

    expect(listSavedFilters("u1", "tasks").map((filter) => parseSavedFilterQuery(filter).search)).toEqual([
      "new",
      "old",
    ]);
  });
});

describe("legacy-shaped records", () => {
  it("excludes a legacy-shaped record from listSavedFilters without throwing", () => {
    const db = getDb();
    db.savedFilters.legacy = {
      id: "legacy",
      userId: "u1",
      scope: "tasks",
      query: { status: ["new", "in_progress"], priority: { min: 3 } },
      usedAt: "2026-08-01T00:00:00.000Z",
    };
    upsertAppliedFilter(baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "valid" } }));

    expect(() => listSavedFilters("u1", "tasks")).not.toThrow();
    const result = listSavedFilters("u1", "tasks");
    expect(result).toHaveLength(1);
    expect(result.some((filter) => filter.id === "legacy")).toBe(false);
  });

  it("does not throw in upsertAppliedFilter when a legacy-shaped record already exists, and creates a new valid record", () => {
    const db = getDb();
    db.savedFilters.legacy = {
      id: "legacy",
      userId: "u1",
      scope: "tasks",
      query: { status: ["new", "in_progress"], priority: { min: 3 } },
      usedAt: "2026-08-01T00:00:00.000Z",
    };

    let created: ReturnType<typeof upsertAppliedFilter> | undefined;
    expect(() => {
      created = upsertAppliedFilter(baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "fresh" } }));
    }).not.toThrow();

    expect(created).toBeDefined();
    expect(parseSavedFilterQuery(created!)).toMatchObject({ search: "fresh", saved: false });
    expect(listSavedFilters("u1", "tasks")).toHaveLength(1);
  });
});

describe("deleteSavedFilter", () => {
  it("deletes the caller's own filter", () => {
    const created = upsertAppliedFilter(baseInput());
    expect(deleteSavedFilter("u1", created.id)).toEqual({ status: "ok" });
    expect(listSavedFilters("u1", "tasks")).toHaveLength(0);
  });

  it("returns not_found for a filter owned by another user", () => {
    const created = upsertAppliedFilter(baseInput({ userId: "u1" }));
    expect(deleteSavedFilter("u2", created.id)).toEqual({ status: "not_found" });
    expect(listSavedFilters("u1", "tasks")).toHaveLength(1);
  });

  it("returns not_found for a missing id", () => {
    expect(deleteSavedFilter("u1", "missing")).toEqual({ status: "not_found" });
  });
});
