import { getDb, saveDb } from "@/shared/lib/db";
import type { Database } from "@/entities/database/schema";
import { appendActivity } from "@/entities/activity/repository";
import type { Comment } from "@/entities/comment/schema";

export interface CreateCommentParams {
  taskId: string;
  authorId: string;
  text: string;
}

export function createComment(input: CreateCommentParams, now: Date = new Date()): Comment {
  const db = getDb();
  const comment: Comment = {
    id: crypto.randomUUID(),
    taskId: input.taskId,
    authorId: input.authorId,
    text: input.text,
    createdAt: now.toISOString(),
  };

  db.comments[comment.id] = comment;
  appendActivity(db, {
    entityType: "task",
    entityId: input.taskId,
    action: "commented",
    at: comment.createdAt,
    byUserId: input.authorId,
    metadata: { commentId: comment.id },
  });
  saveDb(db);
  return comment;
}

export function listCommentsForTask(taskId: string, db: Database = getDb()): Comment[] {
  return Object.values(db.comments)
    .filter((comment) => comment.taskId === taskId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id));
}
