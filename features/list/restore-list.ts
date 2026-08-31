import { restoreList as restoreListInRepository, type RestoreListOutcome } from "@/entities/list/repository";

export function restoreList(userId: string, listId: string, now: Date = new Date()): Promise<RestoreListOutcome> {
  return restoreListInRepository(listId, userId, now);
}
