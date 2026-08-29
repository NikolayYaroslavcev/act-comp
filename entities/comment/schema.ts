import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/entities/common/schema";

export const commentSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  authorId: idSchema,
  text: z.string().min(1).max(2000),
  createdAt: isoDateTimeSchema,
});

export type Comment = z.infer<typeof commentSchema>;
