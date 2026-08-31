import { z } from "zod";
import { historyEntrySchema, idSchema, isoDateTimeSchema } from "@/entities/common/schema";

export const taskStatusSchema = z.enum(["new", "in_progress", "done"]);

export const taskPrioritySchema = z.number().int().min(1).max(5);

const taskExtensionSchema = z.object({
  commentId: idSchema,
  addedMin: z.number().int().positive(),
});

export const taskSchema = z.object({
  id: idSchema,
  listId: idSchema,
  code: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string().max(5000),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  category: z.string().min(1).nullable(),
  tags: z.array(z.string().min(1)),
  dependsOn: z.array(idSchema),
  parentId: idSchema.nullable(),
  subtaskIds: z.array(idSchema),
  deadline: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  estimatedMin: z.number().int().nonnegative(),
  timeSpentMin: z.number().int().nonnegative(),
  timerStartedAt: isoDateTimeSchema.nullable(),
  timerPausedAt: isoDateTimeSchema.nullable(),
  extensions: z.array(taskExtensionSchema),
  history: z.array(historyEntrySchema),
  deletedAt: isoDateTimeSchema.nullable(),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Task = z.infer<typeof taskSchema>;
