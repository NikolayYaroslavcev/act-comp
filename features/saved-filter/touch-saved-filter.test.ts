import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/shared/lib/db";
import { upsertAppliedFilter } from "@/entities/saved-filter/repository";
import { EMPTY_TASK_FILTER_CRITERIA } from "@/entities/saved-filter/query-schema";
import { touchSavedFilterForUser } from "./touch-saved-filter";

beforeEach(() => {
  getDb().savedFilters = {};
});

describe("touchSavedFilterForUser", () => {
  it("touches the caller's own filter", () => {
    const created = upsertAppliedFilter({
      userId: "u1",
      scope: "tasks",
      criteria: EMPTY_TASK_FILTER_CRITERIA,
      saved: true,
      label: null,
    });

    const result = touchSavedFilterForUser("u1", created.id);
    expect(result.status).toBe("ok");
  });

  it("refuses to touch another user's filter", () => {
    const created = upsertAppliedFilter({
      userId: "u1",
      scope: "tasks",
      criteria: EMPTY_TASK_FILTER_CRITERIA,
      saved: true,
      label: null,
    });

    expect(touchSavedFilterForUser("u2", created.id)).toEqual({ status: "not_found" });
  });
});
