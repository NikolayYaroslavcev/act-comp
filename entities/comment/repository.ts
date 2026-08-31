import { getDb, saveDb } from "@/shared/lib/db";
import type { Database } from "@/entities/database/schema";
import { appendActivity } from "@/entities/activity/repository";
import type { Comment } from "@/entities/comment/schema";

export interface CreateCommentParams {
  taskId: string;
  authorId: string;
  text: string;
}

export async function createComment(input: CreateCommentParams, now: Date = new Date()): Promise<Comment> {
  const db = await getDb();
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
  await saveDb(db);
  return comment;
}

export async function listCommentsForTask(taskId: string, db?: Database): Promise<Comment[]> {
  const resolved = db ?? (await getDb());
  return Object.values(resolved.comments)
    .filter((comment) => comment.taskId === taskId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id));
}
