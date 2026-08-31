import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/entities/common/schema";

const activityEntityTypeSchema = z.enum(["list", "task", "user"]);

const activityActionSchema = z.enum([
  "created",
  "updated",
  "status_changed",
  "deleted",
  "restored",
  "rolled_back",
  "commented",
  "shared",
  "duplicated",
  "time_extended",
  "timer_started",
  "timer_paused",
  "timer_resumed",
  "timer_stopped",
  "attachment_added",
  "attachment_deleted",
  "work_day_hours_changed",
]);

const activityMetadataSchema = z.object({
  field: z.string().min(1).optional(),
  old: z.unknown().optional(),
  new: z.unknown().optional(),
  historyIndex: z.number().int().nonnegative().optional(),
  sourceTaskId: idSchema.optional(),
  commentId: idSchema.optional(),
  attachmentId: idSchema.optional(),
  filename: z.string().min(1).max(255).optional(),
});

export const activitySchema = z.object({
  id: idSchema,
  entityType: activityEntityTypeSchema,
  entityId: idSchema,
  action: activityActionSchema,
  at: isoDateTimeSchema,
  byUserId: idSchema,
  metadata: activityMetadataSchema.optional(),
});

export type ActivityEntityType = z.infer<typeof activityEntityTypeSchema>;
export type ActivityAction = z.infer<typeof activityActionSchema>;
export type ActivityMetadata = z.infer<typeof activityMetadataSchema>;
export type Activity = z.infer<typeof activitySchema>;
