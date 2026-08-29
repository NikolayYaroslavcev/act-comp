import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/entities/common/schema";
import { taskPrioritySchema, taskStatusSchema } from "@/entities/task/schema";

export const createTaskInputSchema = z.object({
  listId: idSchema,
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().default(""),
  priority: taskPrioritySchema.optional().default(3),
  category: z.string().min(1).nullable().optional().default(null),
  tags: z.array(z.string().min(1)).optional().default([]),
  parentId: idSchema.nullable().optional().default(null),
  deadline: isoDateTimeSchema.nullable().optional().default(null),
  estimatedMin: z.number().int().nonnegative().optional().default(0),
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

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
