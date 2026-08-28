import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/shared/lib/db";
import { EMPTY_TASK_FILTER_CRITERIA, parseSavedFilterQuery } from "@/entities/saved-filter/query-schema";
import { saveFilterForUser } from "./save-filter";

beforeEach(() => {
  getDb().savedFilters = {};
});

describe("saveFilterForUser", () => {
  it("records the filter as saved with the given label", () => {
    const result = saveFilterForUser("u1", { ...EMPTY_TASK_FILTER_CRITERIA, search: "deploy" }, "My deploys");

    expect(parseSavedFilterQuery(result)).toMatchObject({ search: "deploy", saved: true, label: "My deploys" });
  });
});
