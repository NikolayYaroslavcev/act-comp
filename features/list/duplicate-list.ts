import { duplicateList as duplicateListInRepository, type DuplicateListOutcome } from "@/entities/list/repository";
import type { DuplicateListInput } from "@/entities/list/requests";

export function duplicateList(userId: string, listId: string, input: DuplicateListInput): DuplicateListOutcome {
  return duplicateListInRepository(listId, userId, input);
}
