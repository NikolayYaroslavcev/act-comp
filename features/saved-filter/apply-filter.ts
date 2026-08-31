import { upsertAppliedFilter, type FilterCriteriaByScope } from "@/entities/saved-filter/repository";
import type { SavedFilter, SavedFilterScope } from "@/entities/saved-filter/schema";

export function applyFilterForUser(userId: string, scope: SavedFilterScope, criteria: FilterCriteriaByScope): SavedFilter {
  return upsertAppliedFilter({ userId, scope, criteria, saved: false, label: null });
}
