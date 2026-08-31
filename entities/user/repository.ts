import { getDb, saveDb } from "@/shared/lib/db";
import { appendActivity } from "@/entities/activity/repository";
import { mergeSettings, settingsEqual } from "@/entities/user/model";
import type { UpdateSettingsInput } from "@/entities/user/requests";
import type { Settings, User } from "@/entities/user/schema";

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const normalized = email.toLowerCase();
  return Object.values((await getDb()).users).find((user) => user.email.toLowerCase() === normalized);
}

export async function findUserById(id: string): Promise<User | undefined> {
  return (await getDb()).users[id];
}

export async function countUsers(): Promise<number> {
  return Object.keys((await getDb()).users).length;
}

export type UpdateUserSettingsOutcome =
  | { status: "not_found" }
  | { status: "ok"; settings: Settings };

export async function updateUserSettings(
  userId: string,
  patch: UpdateSettingsInput,
  now: Date = new Date(),
): Promise<UpdateUserSettingsOutcome> {
  const db = await getDb();
  const existing = db.users[userId];
  if (!existing) {
    return { status: "not_found" };
  }

  const nextSettings = mergeSettings(existing.settings, patch);
  if (settingsEqual(existing.settings, nextSettings)) {
    return { status: "ok", settings: existing.settings };
  }

  if (nextSettings.workDayHours !== existing.settings.workDayHours) {
    appendActivity(db, {
      entityType: "user",
      entityId: userId,
      action: "work_day_hours_changed",
      at: now.toISOString(),
      byUserId: userId,
      metadata: { field: "workDayHours", old: existing.settings.workDayHours, new: nextSettings.workDayHours },
    });
  }

  db.users[userId] = { ...existing, settings: nextSettings };
  await saveDb(db);
  return { status: "ok", settings: nextSettings };
}
