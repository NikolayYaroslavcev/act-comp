import { getDb, saveDb } from "@/shared/lib/db";

export async function listAckedNotificationKeys(userId: string): Promise<string[]> {
  return (await getDb()).notificationAcks[userId] ?? [];
}

export async function ackNotificationKeys(userId: string, keys: string[]): Promise<string[]> {
  const db = await getDb();
  const merged = new Set(db.notificationAcks[userId] ?? []);
  for (const key of keys) {
    merged.add(key);
  }
  const next = [...merged];
  db.notificationAcks[userId] = next;
  await saveDb(db);
  return next;
}
