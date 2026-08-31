import { deleteSavedFilter, type DeleteSavedFilterOutcome } from "@/entities/saved-filter/repository";

export function deleteSavedFilterForUser(userId: string, id: string): Promise<DeleteSavedFilterOutcome> {
  return deleteSavedFilter(userId, id);
}
