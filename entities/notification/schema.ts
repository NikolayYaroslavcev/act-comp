import { z } from "zod";
import { idSchema } from "@/entities/common/schema";

const notificationKindSchema = z.enum(["time_threshold", "deadline_reminder", "work_day_hours_changed"]);

export const dueNotificationSchema = z.object({
  key: z.string().min(1),
  kind: notificationKindSchema,
  entityType: z.enum(["task", "list", "user"]),
  entityId: idSchema,
  threshold: z.union([
    z.literal(75),
    z.literal(90),
    z.literal(100),
    z.literal(15),
    z.literal(10),
    z.literal(5),
    z.null(),
  ]),
  title: z.string().min(1),
  body: z.string().min(1),
});

export const ackNotificationsInputSchema = z.object({
  keys: z.array(z.string().min(1)).min(1),
});
