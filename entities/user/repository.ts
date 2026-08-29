import { getDb, saveDb } from "@/shared/lib/db";
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

export function updateUserSettings(userId: string, patch: UpdateSettingsInput): UpdateUserSettingsOutcome {
  const db = getDb();
  const existing = db.users[userId];
  if (!existing) {
    return { status: "not_found" };
  }

  const nextSettings = mergeSettings(existing.settings, patch);
  if (settingsEqual(existing.settings, nextSettings)) {
    return { status: "ok", settings: existing.settings };
  }

  db.users[userId] = { ...existing, settings: nextSettings };
  saveDb(db);
  return { status: "ok", settings: nextSettings };
}
