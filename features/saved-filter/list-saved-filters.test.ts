import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/shared/lib/db";
import { upsertAppliedFilter } from "@/entities/saved-filter/repository";
import { EMPTY_TASK_FILTER_CRITERIA } from "@/entities/saved-filter/query-schema";
import { listSavedFiltersForUser } from "./list-saved-filters";

beforeEach(() => {
  getDb().savedFilters = {};
});

describe("listSavedFiltersForUser", () => {
  it("splits the user's filters into recent and saved groups", () => {
    upsertAppliedFilter({ userId: "u1", scope: "tasks", criteria: EMPTY_TASK_FILTER_CRITERIA, saved: false, label: null });
    upsertAppliedFilter({
      userId: "u1",
      scope: "tasks",
      criteria: { ...EMPTY_TASK_FILTER_CRITERIA, search: "pinned" },
      saved: true,
      label: "Pinned",
    });

    const groups = listSavedFiltersForUser("u1", "tasks");
    expect(groups.recent).toHaveLength(1);
    expect(groups.saved).toHaveLength(1);
  });

  it("never includes another user's filters", () => {
    upsertAppliedFilter({ userId: "u2", scope: "tasks", criteria: EMPTY_TASK_FILTER_CRITERIA, saved: false, label: null });

    const groups = listSavedFiltersForUser("u1", "tasks");
    expect(groups.recent).toHaveLength(0);
    expect(groups.saved).toHaveLength(0);
  });

  it("excludes a legacy-shaped record from both recent and saved without throwing", () => {
    getDb().savedFilters.legacy = {
      id: "legacy",
      userId: "u1",
      scope: "tasks",
      query: { status: ["new", "in_progress"], priority: { min: 3 } },
      usedAt: "2026-08-01T00:00:00.000Z",
    };
    upsertAppliedFilter({ userId: "u1", scope: "tasks", criteria: EMPTY_TASK_FILTER_CRITERIA, saved: false, label: null });

    let groups: ReturnType<typeof listSavedFiltersForUser> | undefined;
    expect(() => {
      groups = listSavedFiltersForUser("u1", "tasks");
    }).not.toThrow();

    expect(groups!.recent.some((filter) => filter.id === "legacy")).toBe(false);
    expect(groups!.saved.some((filter) => filter.id === "legacy")).toBe(false);
  });
});
