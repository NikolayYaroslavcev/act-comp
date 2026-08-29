import { findListById } from "@/entities/list/repository";
import { canEditList } from "@/entities/list/model";
import { createTask as createTaskInRepository } from "@/entities/task/repository";
import type { CreateTaskInput } from "@/entities/task/requests";
import type { Task } from "@/entities/task/schema";

export type CreateTaskOutcome =
  | { status: "list_not_found" }
  | { status: "forbidden" }
  | { status: "ok"; task: Task };

export function createTaskForUser(userId: string, input: CreateTaskInput): CreateTaskOutcome {
  const list = findListById(input.listId);
  if (!list || list.deletedAt !== null) {
    return { status: "list_not_found" };
  }

  if (!canEditList(list, userId)) {
    return { status: "forbidden" };
  }

  return { status: "ok", task: createTaskInRepository(input) };
}
