import { listLists } from "@/entities/list/repository";
import { listActivity } from "@/entities/activity/repository";
import { findLatestListActivity, isListArchiveCandidate, selectVisibleLists } from "@/entities/list/model";
import type { TaskList } from "@/entities/list/schema";

export async function getArchiveCandidates(userId: string, now: Date = new Date()): Promise<TaskList[]> {
  const visibleLists = selectVisibleLists(await listLists(), userId);
  const activities = await listActivity();

  return visibleLists.filter((list) => {
    const latestActivity = findLatestListActivity(list, activities);
    return isListArchiveCandidate(latestActivity?.at ?? null, now);
  });
}
