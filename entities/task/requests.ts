import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/entities/common/schema";
import { taskPrioritySchema, taskStatusSchema } from "@/entities/task/schema";

export const createTaskInputSchema = z.object({
  listId: idSchema,
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().default(""),
  // priority/category/estimatedMin intentionally have no schema-level default:
  // an omitted field must stay undefined so createTask can fall back to the
  // creating user's settings.taskDefaults instead of a fixed value.
  priority: taskPrioritySchema.optional(),
  category: z.string().min(1).nullable().optional(),
  tags: z.array(z.string().min(1)).optional().default([]),
  parentId: idSchema.nullable().optional().default(null),
  deadline: isoDateTimeSchema.nullable().optional().default(null),
  estimatedMin: z.number().int().nonnegative().optional(),
});

export const updateTaskInputSchema = z
  .object({
    title: z.string().min(1).max(300),
    description: z.string().max(5000),
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    category: z.string().min(1).nullable(),
    tags: z.array(z.string().min(1)),
    deadline: isoDateTimeSchema.nullable(),
    estimatedMin: z.number().int().nonnegative(),
    dependsOn: z.array(idSchema),
    parentId: idSchema.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const timerActionInputSchema = z.strictObject({
  action: z.enum(["start", "pause", "resume", "stop"]),
});

export const rollbackTaskInputSchema = z.strictObject({
  historyIndex: z.number().int().nonnegative(),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
export type TimerAction = z.infer<typeof timerActionInputSchema>["action"];
