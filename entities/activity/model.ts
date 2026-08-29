import type { Activity } from "@/entities/activity/schema";

export function findLatestActivityAmong(entityIds: ReadonlySet<string>, activities: Activity[]): Activity | null {
  let latest: Activity | null = null;
  for (const activity of activities) {
    if (!entityIds.has(activity.entityId)) {
      continue;
    }
    if (!latest || new Date(activity.at).getTime() > new Date(latest.at).getTime()) {
      latest = activity;
    }
  }

  return latest;
}
