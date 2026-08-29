import { touchSavedFilter, type TouchSavedFilterOutcome } from "@/entities/saved-filter/repository";

export function touchSavedFilterForUser(userId: string, id: string): TouchSavedFilterOutcome {
  return touchSavedFilter(userId, id);
}
