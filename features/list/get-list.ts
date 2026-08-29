import { findListById } from "@/entities/list/repository";
import { canViewList } from "@/entities/list/model";
import type { TaskList } from "@/entities/list/schema";

export type GetListOutcome = { status: "not_found" } | { status: "ok"; list: TaskList };

export function getVisibleList(userId: string, listId: string): GetListOutcome {
  const list = findListById(listId);
  if (!list || list.deletedAt !== null || !canViewList(list, userId)) {
    return { status: "not_found" };
  }

  return { status: "ok", list };
}
