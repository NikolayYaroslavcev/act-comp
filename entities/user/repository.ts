import { getDb, saveDb } from "@/shared/lib/db";
import { appendActivity } from "@/entities/activity/repository";
import { mergeSettings, settingsEqual } from "@/entities/user/model";
import type { UpdateSettingsInput } from "@/entities/user/requests";
import type { Settings, User } from "@/entities/user/schema";

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.toLowerCase();
  return Object.values(getDb().users).find((user) => user.email.toLowerCase() === normalized);
}

export function findUserById(id: string): User | undefined {
  return getDb().users[id];
}

export function countUsers(): number {
  return Object.keys(getDb().users).length;
}

export type UpdateUserSettingsOutcome =
  | { status: "not_found" }
  | { status: "ok"; settings: Settings };

export function updateUserSettings(
  userId: string,
  patch: UpdateSettingsInput,
  now: Date = new Date(),
): UpdateUserSettingsOutcome {
  const db = getDb();
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
  saveDb(db);
  return { status: "ok", settings: nextSettings };
}
