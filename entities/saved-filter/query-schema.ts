import { z } from "zod";
import { isoDateTimeSchema } from "@/entities/common/schema";
import { taskPrioritySchema, taskStatusSchema } from "@/entities/task/schema";
import type { SavedFilter } from "@/entities/saved-filter/schema";

export const taskFilterCriteriaSchema = z.object({
  search: z.string(),
  status: z.array(taskStatusSchema),
  category: z.string().min(1).nullable(),
  tags: z.array(z.string().min(1)),
  priorityMin: taskPrioritySchema.nullable(),
  priorityMax: taskPrioritySchema.nullable(),
  deadlineFrom: isoDateTimeSchema.nullable(),
  deadlineTo: isoDateTimeSchema.nullable(),
});

export type TaskFilterCriteria = z.infer<typeof taskFilterCriteriaSchema>;

export const savedFilterQuerySchema = taskFilterCriteriaSchema.extend({
  saved: z.boolean(),
  label: z.string().min(1).max(100).nullable(),
});

export type SavedFilterQuery = z.infer<typeof savedFilterQuerySchema>;

export const EMPTY_TASK_FILTER_CRITERIA: TaskFilterCriteria = {
  search: "",
  status: [],
  category: null,
  tags: [],
  priorityMin: null,
  priorityMax: null,
  deadlineFrom: null,
  deadlineTo: null,
};

/**
 * Fixed key order + sorted arrays so two criteria objects that differ only
 * in array/key order still serialize identically — areTaskFilterCriteriaEqual
 * relies on this instead of a raw JSON.stringify comparison.
 */
export function normalizeTaskFilterCriteria(criteria: Partial<TaskFilterCriteria>): TaskFilterCriteria {
  return {
    search: criteria.search ?? "",
    status: [...(criteria.status ?? [])].sort(),
    category: criteria.category ?? null,
    tags: [...(criteria.tags ?? [])].sort(),
    priorityMin: criteria.priorityMin ?? null,
    priorityMax: criteria.priorityMax ?? null,
    deadlineFrom: criteria.deadlineFrom ?? null,
    deadlineTo: criteria.deadlineTo ?? null,
  };
}

export function areTaskFilterCriteriaEqual(a: TaskFilterCriteria, b: TaskFilterCriteria): boolean {
  return JSON.stringify(normalizeTaskFilterCriteria(a)) === JSON.stringify(normalizeTaskFilterCriteria(b));
}

export function parseSavedFilterQuery(filter: SavedFilter): SavedFilterQuery {
  return savedFilterQuerySchema.parse(filter.query);
}

/**
 * Same as parseSavedFilterQuery, but for call sites that iterate over
 * potentially arbitrary/legacy persisted records (as opposed to records this
 * feature just wrote itself) — returns null instead of throwing so a
 * malformed record can be skipped rather than crashing the caller.
 */
export function safeParseSavedFilterQuery(filter: SavedFilter): SavedFilterQuery | null {
  const result = savedFilterQuerySchema.safeParse(filter.query);
  return result.success ? result.data : null;
}
