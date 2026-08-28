import { upsertAppliedFilter } from "@/entities/saved-filter/repository";
import type { TaskFilterCriteria } from "@/entities/saved-filter/query-schema";
import type { SavedFilter } from "@/entities/saved-filter/schema";

export function applyFilterForUser(userId: string, criteria: TaskFilterCriteria): SavedFilter {
  return upsertAppliedFilter({ userId, scope: "tasks", criteria, saved: false, label: null });
}
