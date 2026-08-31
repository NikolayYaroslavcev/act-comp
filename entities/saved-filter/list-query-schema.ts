import { z } from "zod";
import { isoDateTimeSchema } from "@/entities/common/schema";
import { listTemplateSchema } from "@/entities/list/schema";
import type { SavedFilter } from "@/entities/saved-filter/schema";

export const listFilterCriteriaSchema = z.object({
  search: z.string(),
  template: z.array(listTemplateSchema),
  deadlineFrom: isoDateTimeSchema.nullable(),
  deadlineTo: isoDateTimeSchema.nullable(),
});

export type ListFilterCriteria = z.infer<typeof listFilterCriteriaSchema>;

export const savedListFilterQuerySchema = listFilterCriteriaSchema.extend({
  saved: z.boolean(),
  label: z.string().min(1).max(100).nullable(),
});

export type SavedListFilterQuery = z.infer<typeof savedListFilterQuerySchema>;

export const EMPTY_LIST_FILTER_CRITERIA: ListFilterCriteria = {
  search: "",
  template: [],
  deadlineFrom: null,
  deadlineTo: null,
};

/**
 * Mirrors normalizeTaskFilterCriteria (entities/saved-filter/query-schema.ts):
 * fixed key order + sorted arrays so two criteria objects differing only in
 * array/key order still serialize identically.
 */
export function normalizeListFilterCriteria(criteria: Partial<ListFilterCriteria>): ListFilterCriteria {
  return {
    search: criteria.search ?? "",
    template: [...(criteria.template ?? [])].sort(),
    deadlineFrom: criteria.deadlineFrom ?? null,
    deadlineTo: criteria.deadlineTo ?? null,
  };
}

export function areListFilterCriteriaEqual(a: ListFilterCriteria, b: ListFilterCriteria): boolean {
  return JSON.stringify(normalizeListFilterCriteria(a)) === JSON.stringify(normalizeListFilterCriteria(b));
}

export function parseSavedListFilterQuery(filter: SavedFilter): SavedListFilterQuery {
  return savedListFilterQuerySchema.parse(filter.query);
}

/**
 * Same as parseSavedListFilterQuery, but returns null instead of throwing for
 * call sites that iterate over potentially malformed/legacy persisted
 * records, mirroring safeParseSavedFilterQuery for the tasks scope.
 */
export function safeParseSavedListFilterQuery(filter: SavedFilter): SavedListFilterQuery | null {
  const result = savedListFilterQuerySchema.safeParse(filter.query);
  return result.success ? result.data : null;
}
