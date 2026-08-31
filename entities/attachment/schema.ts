import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/entities/common/schema";

export const attachmentSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  filename: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mimeType: z.string().min(1),
  uploadedAt: isoDateTimeSchema,
  uploadedBy: idSchema,
});

export type Attachment = z.infer<typeof attachmentSchema>;
