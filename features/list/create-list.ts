import { createList as createListInRepository } from "@/entities/list/repository";
import type { CreateListInput } from "@/entities/list/requests";
import type { TaskList } from "@/entities/list/schema";

export function createList(ownerId: string, input: CreateListInput): Promise<TaskList> {
  return createListInRepository(ownerId, input);
}
