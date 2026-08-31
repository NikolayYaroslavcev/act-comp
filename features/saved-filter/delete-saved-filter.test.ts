import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/shared/lib/db";
import { upsertAppliedFilter } from "@/entities/saved-filter/repository";
import { EMPTY_TASK_FILTER_CRITERIA } from "@/entities/saved-filter/query-schema";
import { deleteSavedFilterForUser } from "./delete-saved-filter";

beforeEach(async () => {
  (await getDb()).savedFilters = {};
});

describe("deleteSavedFilterForUser", () => {
  it("deletes the caller's own filter", async () => {
    const created = await upsertAppliedFilter({
      userId: "u1",
      scope: "tasks",
      criteria: EMPTY_TASK_FILTER_CRITERIA,
      saved: true,
      label: null,
    });

    expect(await deleteSavedFilterForUser("u1", created.id)).toEqual({ status: "ok" });
  });

  it("refuses to delete another user's filter", async () => {
    const created = await upsertAppliedFilter({
      userId: "u1",
      scope: "tasks",
      criteria: EMPTY_TASK_FILTER_CRITERIA,
      saved: true,
      label: null,
    });

    expect(await deleteSavedFilterForUser("u2", created.id)).toEqual({ status: "not_found" });
  });
});
