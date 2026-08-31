import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/shared/lib/db";
import { EMPTY_LIST_FILTER_CRITERIA, parseSavedListFilterQuery } from "@/entities/saved-filter/list-query-schema";
import { EMPTY_TASK_FILTER_CRITERIA, parseSavedFilterQuery } from "@/entities/saved-filter/query-schema";
import { applyFilterForUser } from "./apply-filter";

beforeEach(async () => {
  (await getDb()).savedFilters = {};
});

describe("applyFilterForUser", () => {
  it("records the applied filter as unsaved (recent) for the given user", async () => {
    const result = await applyFilterForUser("u1", "tasks", { ...EMPTY_TASK_FILTER_CRITERIA, search: "deploy" });

    expect(result.userId).toBe("u1");
    expect(result.scope).toBe("tasks");
    expect(parseSavedFilterQuery(result)).toMatchObject({ search: "deploy", saved: false });
  });

  it("records an applied list filter under the lists scope", async () => {
    const result = await applyFilterForUser("u1", "lists", { ...EMPTY_LIST_FILTER_CRITERIA, search: "sprint" });

    expect(result.scope).toBe("lists");
    expect(parseSavedListFilterQuery(result)).toMatchObject({ search: "sprint", saved: false });
  });
});
