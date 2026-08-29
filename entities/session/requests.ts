import { z } from "zod";
import { idSchema } from "@/entities/common/schema";

export const createSessionInputSchema = z.object({
  userId: idSchema,
  ip: z.string().min(1),
  device: z.string().min(1),
  rememberMe: z.boolean(),
});

export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
