import { upsertAppliedFilter, type FilterCriteriaByScope } from "@/entities/saved-filter/repository";
import type { SavedFilter, SavedFilterScope } from "@/entities/saved-filter/schema";

export function saveFilterForUser(
  userId: string,
  scope: SavedFilterScope,
  criteria: FilterCriteriaByScope,
  label: string | null,
): Promise<SavedFilter> {
  return upsertAppliedFilter({ userId, scope, criteria, saved: true, label });
}
