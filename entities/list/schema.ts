import { z } from "zod";
import { historyEntrySchema, idSchema, isoDateTimeSchema } from "@/entities/common/schema";

export const listTemplateSchema = z.enum(["work", "personal", "project"]);

export const sharedAccessSchema = z.enum(["read", "edit"]);

export const listShareSchema = z.object({
  userId: idSchema,
  access: sharedAccessSchema,
});

export const listSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  title: z.string().min(1).max(200),
  template: listTemplateSchema,
  taskIds: z.array(idSchema),
  deadline: isoDateTimeSchema.nullable(),
  sharedWith: z.array(listShareSchema),
  history: z.array(historyEntrySchema),
  deletedAt: isoDateTimeSchema.nullable(),
  lastActivityAt: isoDateTimeSchema,
});

export type ListTemplate = z.infer<typeof listTemplateSchema>;
export type SharedAccess = z.infer<typeof sharedAccessSchema>;
export type ListShare = z.infer<typeof listShareSchema>;
export type TaskList = z.infer<typeof listSchema>;
