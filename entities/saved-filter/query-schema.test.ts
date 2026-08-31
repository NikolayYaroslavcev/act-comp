import { describe, expect, it } from "vitest";
import {
  areTaskFilterCriteriaEqual,
  EMPTY_TASK_FILTER_CRITERIA,
  normalizeTaskFilterCriteria,
  parseSavedFilterQuery,
  safeParseSavedFilterQuery,
  savedFilterQuerySchema,
  taskFilterCriteriaSchema,
  type TaskFilterCriteria,
} from "./query-schema";
import type { SavedFilter } from "./schema";

function makeCriteria(overrides: Partial<TaskFilterCriteria> = {}): TaskFilterCriteria {
  return { ...EMPTY_TASK_FILTER_CRITERIA, ...overrides };
}

describe("taskFilterCriteriaSchema", () => {
  it("accepts the empty criteria", () => {
    expect(taskFilterCriteriaSchema.safeParse(EMPTY_TASK_FILTER_CRITERIA).success).toBe(true);
  });

  it("accepts a fully populated criteria object", () => {
    const result = taskFilterCriteriaSchema.safeParse(
      makeCriteria({
        search: "deploy",
        status: ["new", "done"],
        category: "Backend",
        tags: ["urgent"],
        priorityMin: 2,
        priorityMax: 5,
        deadlineFrom: "2026-08-01T00:00:00.000Z",
        deadlineTo: "2026-09-01T00:00:00.000Z",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an out-of-range priority", () => {
    expect(taskFilterCriteriaSchema.safeParse(makeCriteria({ priorityMin: 9 })).success).toBe(false);
  });

  it("rejects a non-datetime deadlineFrom", () => {
    expect(taskFilterCriteriaSchema.safeParse(makeCriteria({ deadlineFrom: "not-a-date" })).success).toBe(false);
  });

  it("strips saved-filter metadata so apply/save POST bodies stay valid", () => {
    const result = taskFilterCriteriaSchema.safeParse({
      ...EMPTY_TASK_FILTER_CRITERIA,
      search: "deploy",
      saved: true,
      label: "Deploys",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ ...EMPTY_TASK_FILTER_CRITERIA, search: "deploy" });
      expect(result.data).not.toHaveProperty("saved");
    }
  });
});

describe("savedFilterQuerySchema", () => {
  it("requires saved and label alongside the criteria fields", () => {
    const result = savedFilterQuerySchema.safeParse({ ...EMPTY_TASK_FILTER_CRITERIA, saved: true, label: "My filter" });
    expect(result.success).toBe(true);
  });

  it("rejects a query missing the saved flag", () => {
    expect(savedFilterQuerySchema.safeParse({ ...EMPTY_TASK_FILTER_CRITERIA, label: null }).success).toBe(false);
  });
});

describe("normalizeTaskFilterCriteria", () => {
  it("sorts status and tags so key/array order does not affect the result", () => {
    const a = normalizeTaskFilterCriteria(makeCriteria({ status: ["done", "new"], tags: ["b", "a"] }));
    const b = normalizeTaskFilterCriteria(makeCriteria({ status: ["new", "done"], tags: ["a", "b"] }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("fills every field with its null/empty default", () => {
    expect(normalizeTaskFilterCriteria({} as TaskFilterCriteria)).toEqual(EMPTY_TASK_FILTER_CRITERIA);
  });
});

describe("areTaskFilterCriteriaEqual", () => {
  it("treats criteria with reordered arrays as equal", () => {
    const a = makeCriteria({ status: ["done", "new"], tags: ["b", "a"] });
    const b = makeCriteria({ status: ["new", "done"], tags: ["a", "b"] });
    expect(areTaskFilterCriteriaEqual(a, b)).toBe(true);
  });

  it("treats criteria with a different search term as not equal", () => {
    expect(areTaskFilterCriteriaEqual(makeCriteria({ search: "a" }), makeCriteria({ search: "b" }))).toBe(false);
  });
});

describe("parseSavedFilterQuery", () => {
  it("parses the query field of a SavedFilter record", () => {
    const filter: SavedFilter = {
      id: "f1",
      userId: "u1",
      scope: "tasks",
      query: { ...EMPTY_TASK_FILTER_CRITERIA, saved: true, label: "Mine" },
      usedAt: "2026-08-01T00:00:00.000Z",
    };
    expect(parseSavedFilterQuery(filter)).toEqual({ ...EMPTY_TASK_FILTER_CRITERIA, saved: true, label: "Mine" });
  });
});

describe("safeParseSavedFilterQuery", () => {
  it("returns null for a SavedFilter whose query does not match the schema", () => {
    const filter: SavedFilter = {
      id: "f1",
      userId: "u1",
      scope: "tasks",
      query: { status: ["new", "in_progress"], priority: { min: 3 } },
      usedAt: "2026-08-01T00:00:00.000Z",
    };
    expect(safeParseSavedFilterQuery(filter)).toBeNull();
  });

  it("returns the parsed data for a valid SavedFilter", () => {
    const filter: SavedFilter = {
      id: "f1",
      userId: "u1",
      scope: "tasks",
      query: { ...EMPTY_TASK_FILTER_CRITERIA, saved: true, label: "Mine" },
      usedAt: "2026-08-01T00:00:00.000Z",
    };
    expect(safeParseSavedFilterQuery(filter)).toEqual({ ...EMPTY_TASK_FILTER_CRITERIA, saved: true, label: "Mine" });
  });
});
