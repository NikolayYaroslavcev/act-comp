import { getDb, saveDb } from "@/shared/lib/db";
import type { Database } from "@/entities/database/schema";
import { compareActivityNewestFirst } from "@/entities/activity/model";
import type { Activity, ActivityAction, ActivityEntityType, ActivityMetadata } from "@/entities/activity/schema";

export type RecordActivityInput = {
  id?: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityAction;
  at: string;
  byUserId: string;
  metadata?: ActivityMetadata;
};

export function appendActivity(db: Database, input: RecordActivityInput): Activity {
  const activity: Activity = {
    id: input.id ?? crypto.randomUUID(),
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    at: input.at,
    byUserId: input.byUserId,
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
  db.activityLog[activity.id] = activity;
  return activity;
}

export async function recordActivity(input: RecordActivityInput): Promise<Activity> {
  const db = await getDb();
  const activity = appendActivity(db, input);
  await saveDb(db);
  return activity;
}

export async function listActivity(): Promise<Activity[]> {
  return Object.values((await getDb()).activityLog);
}

export async function listActivityForTask(taskId: string, db?: Database): Promise<Activity[]> {
  const resolved = db ?? (await getDb());
  return Object.values(resolved.activityLog)
    .filter((activity) => activity.entityType === "task" && activity.entityId === taskId)
    .sort(compareActivityNewestFirst);
}

export async function listActivityForUser(userId: string, db?: Database): Promise<Activity[]> {
  const resolved = db ?? (await getDb());
  return Object.values(resolved.activityLog)
    .filter((activity) => activity.entityType === "user" && activity.entityId === userId)
    .sort(compareActivityNewestFirst);
}
