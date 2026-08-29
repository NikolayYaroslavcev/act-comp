import { shareList as shareListInRepository, type ShareListOutcome } from "@/entities/list/repository";
import type { ShareListInput } from "@/entities/list/requests";

export function shareList(userId: string, listId: string, input: ShareListInput): ShareListOutcome {
  return shareListInRepository(listId, userId, input);
}
