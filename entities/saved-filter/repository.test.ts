import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/shared/lib/db";
import {
  deleteSavedFilter,
  listSavedFilters,
  touchSavedFilter,
  upsertAppliedFilter,
  type UpsertFilterInput,
} from "./repository";
import { EMPTY_TASK_FILTER_CRITERIA, parseSavedFilterQuery } from "./query-schema";
import { EMPTY_LIST_FILTER_CRITERIA, parseSavedListFilterQuery } from "./list-query-schema";

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

beforeEach(async () => {
  const db = await getDb();
  db.savedFilters = {};
});

describe("upsertAppliedFilter", () => {
  it("creates a new recent filter", async () => {
    const created = await upsertAppliedFilter(baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "deploy" } }));
    expect(created.userId).toBe("u1");
    expect(created.scope).toBe("tasks");
    expect(parseSavedFilterQuery(created)).toMatchObject({ search: "deploy", saved: false });
  });

  it("updates usedAt instead of creating a duplicate for an equivalent recent filter", async () => {
    const first = await upsertAppliedFilter(baseInput(), new Date("2026-08-01T00:00:00.000Z"));
    const second = await upsertAppliedFilter(baseInput(), new Date("2026-08-02T00:00:00.000Z"));

    expect(second.id).toBe(first.id);
    expect(second.usedAt).toBe("2026-08-02T00:00:00.000Z");
    expect(await listSavedFilters("u1", "tasks")).toHaveLength(1);
  });

  it("does not treat reordered status/tags arrays as a different filter", async () => {
    await upsertAppliedFilter(baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, status: ["done", "new"] } }));
    await upsertAppliedFilter(baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, status: ["new", "done"] } }));

    expect(await listSavedFilters("u1", "tasks")).toHaveLength(1);
  });

  it("caps recent (unsaved) filters at 5 per user+scope, evicting the oldest", async () => {
    for (let i = 0; i < 6; i += 1) {
      await upsertAppliedFilter(
        baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: `q${i}` } }),
        new Date(2026, 7, i + 1),
      );
    }

    const recent = await listSavedFilters("u1", "tasks");
    expect(recent).toHaveLength(5);
    expect(recent.every((filter) => parseSavedFilterQuery(filter).search !== "q0")).toBe(true);
  });

  it("does not let saved filters count against the recent cap", async () => {
    await upsertAppliedFilter(baseInput({ saved: true, criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "pinned" } }));
    for (let i = 0; i < 5; i += 1) {
      await upsertAppliedFilter(
        baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: `q${i}` } }),
        new Date(2026, 7, i + 1),
      );
    }

    const all = await listSavedFilters("u1", "tasks");
    expect(all).toHaveLength(6);
    expect(all.some((filter) => parseSavedFilterQuery(filter).search === "pinned")).toBe(true);
  });

  it("keeps a saved filter and a recent filter with identical criteria as two separate records", async () => {
    const criteria = { ...EMPTY_TASK_FILTER_CRITERIA, search: "shared" };
    await upsertAppliedFilter(baseInput({ criteria, saved: false }));
    await upsertAppliedFilter(baseInput({ criteria, saved: true }));

    expect(await listSavedFilters("u1", "tasks")).toHaveLength(2);
  });

  it("scopes filters per user", async () => {
    await upsertAppliedFilter(baseInput({ userId: "u1" }));
    await upsertAppliedFilter(baseInput({ userId: "u2" }));

    expect(await listSavedFilters("u1", "tasks")).toHaveLength(1);
    expect(await listSavedFilters("u2", "tasks")).toHaveLength(1);
  });

  it("sorts filters by usedAt descending", async () => {
    await upsertAppliedFilter(
      baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "old" } }),
      new Date("2026-08-01T00:00:00.000Z"),
    );
    await upsertAppliedFilter(
      baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "new" } }),
      new Date("2026-08-05T00:00:00.000Z"),
    );

    expect((await listSavedFilters("u1", "tasks")).map((filter) => parseSavedFilterQuery(filter).search)).toEqual([
      "new",
      "old",
    ]);
  });
});

describe("upsertAppliedFilter for the lists scope", () => {
  it("creates and lists a recent list filter using the list criteria schema", async () => {
    const created = await upsertAppliedFilter(
      baseInput({ scope: "lists", criteria: { ...EMPTY_LIST_FILTER_CRITERIA, search: "sprint" } }),
    );

    expect(created.scope).toBe("lists");
    expect(parseSavedListFilterQuery(created)).toMatchObject({ search: "sprint", saved: false });
    expect(await listSavedFilters("u1", "lists")).toHaveLength(1);
  });

  it("keeps tasks-scope and lists-scope filters for the same user completely separate", async () => {
    await upsertAppliedFilter(baseInput({ scope: "tasks" }));
    await upsertAppliedFilter(baseInput({ scope: "lists", criteria: EMPTY_LIST_FILTER_CRITERIA }));

    expect(await listSavedFilters("u1", "tasks")).toHaveLength(1);
    expect(await listSavedFilters("u1", "lists")).toHaveLength(1);
  });

  it("does not treat a reordered template array as a different list filter", async () => {
    await upsertAppliedFilter(baseInput({ scope: "lists", criteria: { ...EMPTY_LIST_FILTER_CRITERIA, template: ["work", "personal"] } }));
    await upsertAppliedFilter(baseInput({ scope: "lists", criteria: { ...EMPTY_LIST_FILTER_CRITERIA, template: ["personal", "work"] } }));

    expect(await listSavedFilters("u1", "lists")).toHaveLength(1);
  });

  it("caps recent list filters at 5 per user, independently of the tasks-scope cap", async () => {
    for (let i = 0; i < 6; i += 1) {
      await upsertAppliedFilter(
        baseInput({ scope: "lists", criteria: { ...EMPTY_LIST_FILTER_CRITERIA, search: `q${i}` } }),
        new Date(2026, 7, i + 1),
      );
    }

    expect(await listSavedFilters("u1", "lists")).toHaveLength(5);
  });
});

describe("legacy-shaped records", () => {
  it("excludes a legacy-shaped record from listSavedFilters without throwing", async () => {
    const db = await getDb();
    db.savedFilters.legacy = {
      id: "legacy",
      userId: "u1",
      scope: "tasks",
      query: { status: ["new", "in_progress"], priority: { min: 3 } },
      usedAt: "2026-08-01T00:00:00.000Z",
    };
    await upsertAppliedFilter(baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "valid" } }));

    const result = await listSavedFilters("u1", "tasks");
    expect(result).toHaveLength(1);
    expect(result.some((filter) => filter.id === "legacy")).toBe(false);
  });

  it("does not throw in upsertAppliedFilter when a legacy-shaped record already exists, and creates a new valid record", async () => {
    const db = await getDb();
    db.savedFilters.legacy = {
      id: "legacy",
      userId: "u1",
      scope: "tasks",
      query: { status: ["new", "in_progress"], priority: { min: 3 } },
      usedAt: "2026-08-01T00:00:00.000Z",
    };

    const created = await upsertAppliedFilter(baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "fresh" } }));

    expect(created).toBeDefined();
    expect(parseSavedFilterQuery(created!)).toMatchObject({ search: "fresh", saved: false });
    expect(await listSavedFilters("u1", "tasks")).toHaveLength(1);
  });
});

describe("deleteSavedFilter", () => {
  it("deletes the caller's own filter", async () => {
    const created = await upsertAppliedFilter(baseInput());
    expect(await deleteSavedFilter("u1", created.id)).toEqual({ status: "ok" });
    expect(await listSavedFilters("u1", "tasks")).toHaveLength(0);
  });

  it("returns not_found for a filter owned by another user", async () => {
    const created = await upsertAppliedFilter(baseInput({ userId: "u1" }));
    expect(await deleteSavedFilter("u2", created.id)).toEqual({ status: "not_found" });
    expect(await listSavedFilters("u1", "tasks")).toHaveLength(1);
  });

  it("returns not_found for a missing id", async () => {
    expect(await deleteSavedFilter("u1", "missing")).toEqual({ status: "not_found" });
  });
});

describe("touchSavedFilter", () => {
  it("updates usedAt on the caller's own filter and leaves the rest of the record unchanged", async () => {
    const created = await upsertAppliedFilter(
      baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "deploy" } }),
      new Date("2026-08-01T00:00:00.000Z"),
    );

    const result = await touchSavedFilter("u1", created.id, new Date("2026-08-10T00:00:00.000Z"));

    expect(result).toEqual({ status: "ok", filter: { ...created, usedAt: "2026-08-10T00:00:00.000Z" } });
    expect(parseSavedFilterQuery(result.status === "ok" ? result.filter : created)).toMatchObject({
      search: "deploy",
      saved: false,
    });
  });

  it("returns not_found for a filter owned by another user and does not modify it", async () => {
    const created = await upsertAppliedFilter(baseInput({ userId: "u1" }), new Date("2026-08-01T00:00:00.000Z"));

    expect(await touchSavedFilter("u2", created.id, new Date("2026-08-10T00:00:00.000Z"))).toEqual({ status: "not_found" });
    expect((await listSavedFilters("u1", "tasks"))[0]?.usedAt).toBe("2026-08-01T00:00:00.000Z");
  });

  it("returns not_found for a missing id", async () => {
    expect(await touchSavedFilter("u1", "missing")).toEqual({ status: "not_found" });
  });

  it("does not affect the recent-cap count when touching a recent filter", async () => {
    const created: Awaited<ReturnType<typeof upsertAppliedFilter>>[] = [];
    for (let i = 0; i < 5; i += 1) {
      created.push(
        await upsertAppliedFilter(
          baseInput({ criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: `q${i}` } }),
          new Date(2026, 7, i + 1),
        ),
      );
    }

    await touchSavedFilter("u1", created[0].id, new Date("2026-08-20T00:00:00.000Z"));

    const recent = await listSavedFilters("u1", "tasks");
    expect(recent).toHaveLength(5);
    expect(recent.map((filter) => filter.id).sort()).toEqual(created.map((filter) => filter.id).sort());
  });

  it("touches a saved (saved:true) filter identically, with no cap interaction", async () => {
    const created = await upsertAppliedFilter(
      baseInput({ saved: true, criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "pinned" } }),
      new Date("2026-08-01T00:00:00.000Z"),
    );

    const result = await touchSavedFilter("u1", created.id, new Date("2026-08-15T00:00:00.000Z"));

    expect(result).toEqual({ status: "ok", filter: { ...created, usedAt: "2026-08-15T00:00:00.000Z" } });
    const all = await listSavedFilters("u1", "tasks");
    expect(all).toHaveLength(1);
    expect(parseSavedFilterQuery(all[0])).toMatchObject({ search: "pinned", saved: true });
  });
});
