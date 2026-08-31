import { getVisibleList } from "@/features/list/get-list";
import { findUserById } from "@/entities/user/repository";
import type { HistoryEntry } from "@/entities/common/schema";

export interface ListHistoryItem extends HistoryEntry {
  actorEmail: string;
}

export type GetListHistoryOutcome = { status: "not_found" } | { status: "ok"; history: ListHistoryItem[] };

/**
 * Surfaces TaskList.history (already written by updateList/deleteList/
 * restoreList — entities/list/repository.ts) to the UI. Reuses the existing
 * per-field diff log rather than a second history/event store; the only
 * thing added here is actor-email resolution and newest-first ordering,
 * mirroring listTaskActivityForUser for tasks.
 */
export function getListHistoryForUser(userId: string, listId: string): GetListHistoryOutcome {
  const visible = getVisibleList(userId, listId);
  if (visible.status === "not_found") {
    return { status: "not_found" };
  }

  // list.history is appended in chronological order with no unique id, so a
  // tie on `at` (two edits within the same millisecond) is broken by
  // original array position rather than left to an unspecified sort order.
  const history = visible.list.history
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const byTime = new Date(b.entry.at).getTime() - new Date(a.entry.at).getTime();
      return byTime !== 0 ? byTime : b.index - a.index;
    })
    .map(({ entry }) => ({ ...entry, actorEmail: findUserById(entry.byUserId)?.email ?? entry.byUserId }));

  return { status: "ok", history };
}
