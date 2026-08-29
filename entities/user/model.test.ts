import { describe, expect, it } from "vitest";
import { mergeSettings, settingsEqual } from "@/entities/user/model";
import { DEFAULT_SETTINGS } from "@/entities/user/schema";

describe("mergeSettings", () => {
  it("changes only the provided top-level field", () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, { theme: "dark" });
    expect(merged.theme).toBe("dark");
    expect(merged.workDayHours).toBe(DEFAULT_SETTINGS.workDayHours);
    expect(merged.notifications).toEqual(DEFAULT_SETTINGS.notifications);
    expect(merged.taskDefaults).toEqual(DEFAULT_SETTINGS.taskDefaults);
  });

  it("merges nested notification flags without dropping the rest", () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, {
      notifications: { otherUserChanges: false },
    });
    expect(merged.notifications).toEqual({
      ...DEFAULT_SETTINGS.notifications,
      otherUserChanges: false,
    });
  });

  it("merges nested taskDefaults without dropping the rest", () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, {
      taskDefaults: { priority: 1 },
    });
    expect(merged.taskDefaults).toEqual({
      ...DEFAULT_SETTINGS.taskDefaults,
      priority: 1,
    });
  });
});

describe("settingsEqual", () => {
  it("treats structurally identical settings as equal", () => {
    expect(settingsEqual(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS })).toBe(true);
  });

  it("detects a nested difference", () => {
    expect(
      settingsEqual(DEFAULT_SETTINGS, {
        ...DEFAULT_SETTINGS,
        notifications: { ...DEFAULT_SETTINGS.notifications, deadlineReminders: false },
      }),
    ).toBe(false);
  });
});
