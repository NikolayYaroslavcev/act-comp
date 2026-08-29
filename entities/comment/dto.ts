import type { Comment } from "@/entities/comment/schema";

export interface CommentWithAuthor extends Comment {
  authorEmail: string;
}
