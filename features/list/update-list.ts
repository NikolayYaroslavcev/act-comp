import { updateList as updateListInRepository, type UpdateListOutcome } from "@/entities/list/repository";
import type { UpdateListInput } from "@/entities/list/requests";

export function updateList(userId: string, listId: string, input: UpdateListInput): Promise<UpdateListOutcome> {
  return updateListInRepository(listId, userId, input);
}
