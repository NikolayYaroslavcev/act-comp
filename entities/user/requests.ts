import { z } from "zod";
import {
  settingsSchema,
  taskDefaultsSchema,
  themeSchema,
} from "@/entities/user/schema";

const updateNotificationSettingsSchema = z.strictObject({
  deadlineReminders: z.boolean().optional(),
  timeThresholdAlerts: z.boolean().optional(),
  workHoursRecalculation: z.boolean().optional(),
  otherUserChanges: z.boolean().optional(),
});

const updateTaskDefaultsSchema = z.strictObject({
  priority: taskDefaultsSchema.shape.priority.optional(),
  category: taskDefaultsSchema.shape.category.optional(),
  estimatedMin: taskDefaultsSchema.shape.estimatedMin.optional(),
});

export const updateSettingsInputSchema = z
  .strictObject({
    theme: themeSchema.optional(),
    workDayHours: settingsSchema.shape.workDayHours.optional(),
    notifications: updateNotificationSettingsSchema.optional(),
    taskDefaults: updateTaskDefaultsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;
