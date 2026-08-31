import { describe, expect, it } from "vitest";
import { updateSettingsInputSchema } from "@/entities/user/requests";

describe("updateSettingsInputSchema", () => {
  it("accepts a theme-only patch", () => {
    const result = updateSettingsInputSchema.safeParse({ theme: "dark" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ theme: "dark" });
    }
  });

  it("accepts a nested notifications patch without requiring every flag", () => {
    const result = updateSettingsInputSchema.safeParse({
      notifications: { deadlineReminders: false },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notifications).toEqual({ deadlineReminders: false });
    }
  });

  it("accepts a nested taskDefaults patch", () => {
    const result = updateSettingsInputSchema.safeParse({
      taskDefaults: { priority: 5, category: null },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.taskDefaults).toEqual({ priority: 5, category: null });
    }
  });

  it("rejects an empty patch", () => {
    expect(updateSettingsInputSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an unknown theme", () => {
    expect(updateSettingsInputSchema.safeParse({ theme: "neon" }).success).toBe(false);
  });

  it("rejects a non-boolean notification flag", () => {
    expect(
      updateSettingsInputSchema.safeParse({
        notifications: { deadlineReminders: "yes" },
      }).success,
    ).toBe(false);
  });

  it("rejects a non-number workDayHours", () => {
    expect(updateSettingsInputSchema.safeParse({ workDayHours: "eight" }).success).toBe(false);
  });

  it("rejects workDayHours of 0", () => {
    expect(updateSettingsInputSchema.safeParse({ workDayHours: 0 }).success).toBe(false);
  });

  it("rejects workDayHours above 24", () => {
    expect(updateSettingsInputSchema.safeParse({ workDayHours: 25 }).success).toBe(false);
  });

  it("accepts a valid workDayHours patch", () => {
    expect(updateSettingsInputSchema.safeParse({ workDayHours: 8 }).success).toBe(true);
  });

  it("rejects a priority outside 1-5", () => {
    expect(
      updateSettingsInputSchema.safeParse({ taskDefaults: { priority: 9 } }).success,
    ).toBe(false);
  });

  it("rejects a negative estimatedMin", () => {
    expect(
      updateSettingsInputSchema.safeParse({ taskDefaults: { estimatedMin: -1 } }).success,
    ).toBe(false);
  });

  it("rejects unknown top-level fields including a spoofed userId", () => {
    expect(updateSettingsInputSchema.safeParse({ theme: "dark", userId: "u2" }).success).toBe(
      false,
    );
  });

  it("rejects unknown nested notification fields", () => {
    expect(
      updateSettingsInputSchema.safeParse({
        notifications: { deadlineReminders: true, sound: true },
      }).success,
    ).toBe(false);
  });
});
