import { findListById } from "@/entities/list/repository";
import { canEditList } from "@/entities/list/model";
import { validateParentAssignment } from "@/entities/task/model";
import { createTask as createTaskInRepository, listTasks } from "@/entities/task/repository";
import type { CreateTaskInput } from "@/entities/task/requests";
import type { Task } from "@/entities/task/schema";

export type CreateTaskOutcome =
  | { status: "list_not_found" }
  | { status: "forbidden" }
  | { status: "invalid_parent" }
  | { status: "ok"; task: Task };

export async function createTaskForUser(userId: string, input: CreateTaskInput): Promise<CreateTaskOutcome> {
  const list = await findListById(input.listId);
  if (!list || list.deletedAt !== null) {
    return { status: "list_not_found" };
  }

  if (!canEditList(list, userId)) {
    return { status: "forbidden" };
  }

  if (input.parentId !== null) {
    const tasksById = new Map((await listTasks()).map((task) => [task.id, task]));
    const childProbe = { id: "", listId: input.listId } as Task;
    if (validateParentAssignment(childProbe, input.parentId, tasksById)) {
      return { status: "invalid_parent" };
    }
  }

  return { status: "ok", task: await createTaskInRepository(input, userId) };
}
