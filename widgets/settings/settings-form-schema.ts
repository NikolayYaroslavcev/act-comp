import { z } from "zod";
import {
  notificationSettingsSchema,
  settingsSchema,
  taskDefaultsSchema,
  themeSchema,
} from "@/entities/user/schema";
import type { Settings } from "@/entities/user/schema";
import type { UpdateSettingsInput } from "@/entities/user/requests";

export const settingsFormSchema = z.object({
  theme: themeSchema,
  workDayHours: settingsSchema.shape.workDayHours,
  notifications: notificationSettingsSchema,
  taskDefaults: z.object({
    priority: taskDefaultsSchema.shape.priority,
    category: z.string(),
    estimatedMin: taskDefaultsSchema.shape.estimatedMin,
  }),
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export function toFormValues(settings: Settings): SettingsFormValues {
  return {
    theme: settings.theme,
    workDayHours: settings.workDayHours,
    notifications: { ...settings.notifications },
    taskDefaults: {
      priority: settings.taskDefaults.priority,
      category: settings.taskDefaults.category ?? "",
      estimatedMin: settings.taskDefaults.estimatedMin,
    },
  };
}

export function toSettingsPatch(initial: Settings, values: SettingsFormValues): UpdateSettingsInput | null {
  const patch: UpdateSettingsInput = {};

  if (values.theme !== initial.theme) {
    patch.theme = values.theme;
  }
  if (values.workDayHours !== initial.workDayHours) {
    patch.workDayHours = values.workDayHours;
  }

  const notifications: NonNullable<UpdateSettingsInput["notifications"]> = {};
  (["deadlineReminders", "timeThresholdAlerts", "workHoursRecalculation", "otherUserChanges"] as const).forEach(
    (key) => {
      if (values.notifications[key] !== initial.notifications[key]) {
        notifications[key] = values.notifications[key];
      }
    },
  );
  if (Object.keys(notifications).length > 0) {
    patch.notifications = notifications;
  }

  const taskDefaults: NonNullable<UpdateSettingsInput["taskDefaults"]> = {};
  if (values.taskDefaults.priority !== initial.taskDefaults.priority) {
    taskDefaults.priority = values.taskDefaults.priority;
  }
  const nextCategory = values.taskDefaults.category.trim() === "" ? null : values.taskDefaults.category.trim();
  if (nextCategory !== initial.taskDefaults.category) {
    taskDefaults.category = nextCategory;
  }
  if (values.taskDefaults.estimatedMin !== initial.taskDefaults.estimatedMin) {
    taskDefaults.estimatedMin = values.taskDefaults.estimatedMin;
  }
  if (Object.keys(taskDefaults).length > 0) {
    patch.taskDefaults = taskDefaults;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
