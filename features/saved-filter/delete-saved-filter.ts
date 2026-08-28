import { deleteSavedFilter, type DeleteSavedFilterOutcome } from "@/entities/saved-filter/repository";

export function deleteSavedFilterForUser(userId: string, id: string): DeleteSavedFilterOutcome {
  return deleteSavedFilter(userId, id);
}
