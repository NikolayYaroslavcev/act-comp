import { listLists } from "@/entities/list/repository";
import { listActivity } from "@/entities/activity/repository";
import { findLatestListActivity, isListArchiveCandidate, selectVisibleLists } from "@/entities/list/model";
import type { TaskList } from "@/entities/list/schema";

export function getArchiveCandidates(userId: string, now: Date = new Date()): TaskList[] {
  const visibleLists = selectVisibleLists(listLists(), userId);
  const activities = listActivity();

  return visibleLists.filter((list) => {
    const latestActivity = findLatestListActivity(list, activities);
    return isListArchiveCandidate(latestActivity?.at ?? null, now);
  });
}
