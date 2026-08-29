import { deleteList as deleteListInRepository, type DeleteListOutcome } from "@/entities/list/repository";

export function deleteList(userId: string, listId: string): DeleteListOutcome {
  return deleteListInRepository(listId, userId);
}
