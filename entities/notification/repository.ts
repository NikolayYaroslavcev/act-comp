import { getDb, saveDb } from "@/shared/lib/db";

export function listAckedNotificationKeys(userId: string): string[] {
  return getDb().notificationAcks[userId] ?? [];
}

export function ackNotificationKeys(userId: string, keys: string[]): string[] {
  const db = getDb();
  const merged = new Set(db.notificationAcks[userId] ?? []);
  for (const key of keys) {
    merged.add(key);
  }
  const next = [...merged];
  db.notificationAcks[userId] = next;
  saveDb(db);
  return next;
}
