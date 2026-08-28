import { upsertAppliedFilter } from "@/entities/saved-filter/repository";
import type { TaskFilterCriteria } from "@/entities/saved-filter/query-schema";
import type { SavedFilter } from "@/entities/saved-filter/schema";

export function saveFilterForUser(userId: string, criteria: TaskFilterCriteria, label: string | null): SavedFilter {
  return upsertAppliedFilter({ userId, scope: "tasks", criteria, saved: true, label });
}
