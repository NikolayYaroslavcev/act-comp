import { findListById } from "@/entities/list/repository";
import { canViewList } from "@/entities/list/model";
import type { TaskList } from "@/entities/list/schema";

export type GetListOutcome = { status: "not_found" } | { status: "ok"; list: TaskList };

export async function getVisibleList(userId: string, listId: string): Promise<GetListOutcome> {
  const list = await findListById(listId);
  if (!list || list.deletedAt !== null || !canViewList(list, userId)) {
    return { status: "not_found" };
  }

  return { status: "ok", list };
}
