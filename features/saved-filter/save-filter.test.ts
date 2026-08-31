import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/shared/lib/db";
import { EMPTY_LIST_FILTER_CRITERIA, parseSavedListFilterQuery } from "@/entities/saved-filter/list-query-schema";
import { EMPTY_TASK_FILTER_CRITERIA, parseSavedFilterQuery } from "@/entities/saved-filter/query-schema";
import { saveFilterForUser } from "./save-filter";

beforeEach(() => {
  getDb().savedFilters = {};
});

describe("saveFilterForUser", () => {
  it("records the filter as saved with the given label", () => {
    const result = saveFilterForUser("u1", "tasks", { ...EMPTY_TASK_FILTER_CRITERIA, search: "deploy" }, "My deploys");

    expect(parseSavedFilterQuery(result)).toMatchObject({ search: "deploy", saved: true, label: "My deploys" });
  });

  it("records a saved list filter under the lists scope", () => {
    const result = saveFilterForUser("u1", "lists", { ...EMPTY_LIST_FILTER_CRITERIA, search: "sprint" }, "My lists");

    expect(result.scope).toBe("lists");
    expect(parseSavedListFilterQuery(result)).toMatchObject({ search: "sprint", saved: true, label: "My lists" });
  });
});
