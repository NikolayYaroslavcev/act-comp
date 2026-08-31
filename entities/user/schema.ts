import { z } from "zod";
import { idSchema } from "@/entities/common/schema";

export const themeSchema = z.enum(["light", "dark", "system"]);

export const notificationSettingsSchema = z.object({
  deadlineReminders: z.boolean(),
  timeThresholdAlerts: z.boolean(),
  workHoursRecalculation: z.boolean(),
  otherUserChanges: z.boolean(),
});

export const taskDefaultsSchema = z.object({
  priority: z.number().int().min(1).max(5),
  category: z.string().min(1).nullable(),
  estimatedMin: z.number().int().nonnegative(),
});

export const settingsSchema = z.object({
  theme: themeSchema,
  workDayHours: z.number().positive().max(24),
  notifications: notificationSettingsSchema,
  taskDefaults: taskDefaultsSchema,
});

export const userSchema = z.object({
  id: idSchema,
  email: z.email(),
  passwordHash: z.string().min(1),
  settings: settingsSchema,
});

export type Theme = z.infer<typeof themeSchema>;
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type User = z.infer<typeof userSchema>;

export const DEFAULT_SETTINGS: Settings = {
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
};
