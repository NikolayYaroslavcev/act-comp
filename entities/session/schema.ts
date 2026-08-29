import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "@/entities/common/schema";

export const sessionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  ip: z.string().min(1),
  device: z.string().min(1),
  createdAt: isoDateTimeSchema,
  rememberMe: z.boolean(),
  revokedAt: isoDateTimeSchema.nullable(),
});

export type Session = z.infer<typeof sessionSchema>;
