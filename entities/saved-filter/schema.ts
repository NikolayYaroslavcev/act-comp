import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/entities/common/schema";

export const savedFilterScopeSchema = z.enum(["tasks", "lists"]);

export const savedFilterSchema = z.object({
  id: idSchema,
  userId: idSchema,
  scope: savedFilterScopeSchema,
  query: z.record(z.string(), z.unknown()),
  usedAt: isoDateTimeSchema,
});

export type SavedFilterScope = z.infer<typeof savedFilterScopeSchema>;
export type SavedFilter = z.infer<typeof savedFilterSchema>;
