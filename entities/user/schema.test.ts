import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, settingsSchema, userSchema } from "@/entities/user/schema";

const validUser = {
  id: "u1",
  email: "admin@example.com",
  passwordHash: "hash",
  settings: {
    theme: "system",
    workDayHours: 8,
    notifications: {
      deadlineReminders: true,
      timeThresholdAlerts: true,
      workHoursRecalculation: true,
      otherUserChanges: true,
    },
    taskDefaults: {
      priority: 3,
      category: null,
      estimatedMin: 60,
    },
  },
};

describe("userSchema", () => {
  it("accepts a valid user", () => {
    expect(userSchema.safeParse(validUser).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = userSchema.safeParse({ ...validUser, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("accepts DEFAULT_SETTINGS-shaped values", () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });

  it("rejects an unknown theme", () => {
    const result = userSchema.safeParse({
      ...validUser,
      settings: { ...validUser.settings, theme: "neon" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a workDayHours above 24", () => {
    const result = userSchema.safeParse({
      ...validUser,
      settings: { ...validUser.settings, workDayHours: 30 },
    });
    expect(result.success).toBe(false);
  });
});
