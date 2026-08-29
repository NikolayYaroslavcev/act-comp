import { getDb } from "@/shared/lib/db";
import type { Activity } from "@/entities/activity/schema";

export function listActivity(): Activity[] {
  return Object.values(getDb().activityLog);
}
