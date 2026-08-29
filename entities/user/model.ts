import type { UpdateSettingsInput } from "@/entities/user/requests";
import type { Settings } from "@/entities/user/schema";

export function mergeSettings(current: Settings, patch: UpdateSettingsInput): Settings {
  return {
    theme: patch.theme ?? current.theme,
    workDayHours: patch.workDayHours ?? current.workDayHours,
    notifications: {
      ...current.notifications,
      ...patch.notifications,
    },
    taskDefaults: {
      ...current.taskDefaults,
      ...patch.taskDefaults,
    },
  };
}

export function settingsEqual(left: Settings, right: Settings): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
