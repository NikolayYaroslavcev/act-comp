import { z } from "zod";
import { commentSchema } from "@/entities/comment/schema";

export const createCommentInputSchema = z.object({
  text: commentSchema.shape.text,
});

export type CreateCommentInput = z.infer<typeof createCommentInputSchema>;
