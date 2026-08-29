import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/entities/common/schema";

export const activityEntityTypeSchema = z.enum(["list", "task"]);

export const activityActionSchema = z.enum([
  "created",
  "updated",
  "status_changed",
  "deleted",
  "restored",
  "commented",
  "shared",
  "duplicated",
  "time_extended",
]);

export const activitySchema = z.object({
  id: idSchema,
  entityType: activityEntityTypeSchema,
  entityId: idSchema,
  action: activityActionSchema,
  at: isoDateTimeSchema,
  byUserId: idSchema,
});

export type ActivityEntityType = z.infer<typeof activityEntityTypeSchema>;
export type ActivityAction = z.infer<typeof activityActionSchema>;
export type Activity = z.infer<typeof activitySchema>;
