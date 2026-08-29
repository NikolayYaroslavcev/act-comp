import { z } from "zod";
import { isoDateTimeSchema } from "@/entities/common/schema";
import { listTemplateSchema, sharedAccessSchema } from "@/entities/list/schema";

export const createListInputSchema = z.object({
  title: z.string().min(1).max(200),
  template: listTemplateSchema,
  deadline: isoDateTimeSchema.nullable().optional().default(null),
});

export const updateListInputSchema = z
  .object({
    title: z.string().min(1).max(200),
    template: listTemplateSchema,
    deadline: isoDateTimeSchema.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const duplicateListInputSchema = z.object({
  copyTasks: z.boolean().optional().default(false),
  copySharedWith: z.boolean().optional().default(false),
});

export const shareListInputSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.email().optional(),
    access: sharedAccessSchema,
  })
  .refine((value) => Boolean(value.userId) !== Boolean(value.email), {
    message: "Provide exactly one of userId or email",
  });

export type CreateListInput = z.infer<typeof createListInputSchema>;
export type UpdateListInput = z.infer<typeof updateListInputSchema>;
export type DuplicateListInput = z.infer<typeof duplicateListInputSchema>;
export type ShareListInput = z.infer<typeof shareListInputSchema>;
