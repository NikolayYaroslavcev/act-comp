import { describe, expect, it } from "vitest";
import {
  areListFilterCriteriaEqual,
  EMPTY_LIST_FILTER_CRITERIA,
  listFilterCriteriaSchema,
  normalizeListFilterCriteria,
  parseSavedListFilterQuery,
  safeParseSavedListFilterQuery,
  savedListFilterQuerySchema,
} from "@/entities/saved-filter/list-query-schema";
import type { SavedFilter } from "@/entities/saved-filter/schema";

function makeFilter(query: unknown): SavedFilter {
  return {
    id: "f1",
    userId: "u1",
    scope: "lists",
    query: query as Record<string, unknown>,
    usedAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("listFilterCriteriaSchema", () => {
  it("accepts a fully specified criteria object", () => {
    const result = listFilterCriteriaSchema.safeParse({
      search: "sprint",
      template: ["work", "personal"],
      deadlineFrom: null,
      deadlineTo: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid template value", () => {
    const result = listFilterCriteriaSchema.safeParse({
      search: "",
      template: ["not-a-template"],
      deadlineFrom: null,
      deadlineTo: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("normalizeListFilterCriteria", () => {
  it("fills in defaults for a partial object", () => {
    expect(normalizeListFilterCriteria({})).toEqual(EMPTY_LIST_FILTER_CRITERIA);
  });

  it("sorts the template array so key order does not affect equality", () => {
    const a = normalizeListFilterCriteria({ template: ["work", "personal"] });
    const b = normalizeListFilterCriteria({ template: ["personal", "work"] });
    expect(a).toEqual(b);
  });
});

describe("areListFilterCriteriaEqual", () => {
  it("treats criteria with reordered template arrays as equal", () => {
    const a = { ...EMPTY_LIST_FILTER_CRITERIA, template: ["work", "personal"] as ("work" | "personal")[] };
    const b = { ...EMPTY_LIST_FILTER_CRITERIA, template: ["personal", "work"] as ("work" | "personal")[] };
    expect(areListFilterCriteriaEqual(a, b)).toBe(true);
  });

  it("treats criteria with a different search term as unequal", () => {
    const a = { ...EMPTY_LIST_FILTER_CRITERIA, search: "a" };
    const b = { ...EMPTY_LIST_FILTER_CRITERIA, search: "b" };
    expect(areListFilterCriteriaEqual(a, b)).toBe(false);
  });
});

describe("parseSavedListFilterQuery / safeParseSavedListFilterQuery", () => {
  it("parses a well-formed saved list filter query", () => {
    const filter = makeFilter({ ...EMPTY_LIST_FILTER_CRITERIA, saved: true, label: "My filter" });
    expect(parseSavedListFilterQuery(filter).label).toBe("My filter");
  });

  it("safe-parse returns null for a malformed record instead of throwing", () => {
    const filter = makeFilter({ nonsense: true });
    expect(safeParseSavedListFilterQuery(filter)).toBeNull();
  });

  it("safe-parse returns null for a task-shaped query stored under the wrong scope", () => {
    const filter = makeFilter({ search: "", status: [], category: null, tags: [], priorityMin: null, priorityMax: null, deadlineFrom: null, deadlineTo: null, saved: false, label: null });
    expect(safeParseSavedListFilterQuery(filter)).toBeNull();
  });
});

describe("savedListFilterQuerySchema", () => {
  it("requires saved and label on top of the base criteria", () => {
    const result = savedListFilterQuerySchema.safeParse(EMPTY_LIST_FILTER_CRITERIA);
    expect(result.success).toBe(false);
  });
});
