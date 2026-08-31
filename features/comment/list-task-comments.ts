import { findListById } from "@/entities/list/repository";
import { canViewList } from "@/entities/list/model";
import { findTaskById } from "@/entities/task/repository";
import { listCommentsForTask } from "@/entities/comment/repository";
import { findUserById } from "@/entities/user/repository";
import type { Comment } from "@/entities/comment/schema";
import type { CommentWithAuthor } from "@/entities/comment/dto";

export type ListTaskCommentsOutcome = { status: "not_found" } | { status: "ok"; comments: CommentWithAuthor[] };

async function toCommentWithAuthor(comment: Comment): Promise<CommentWithAuthor> {
  return { ...comment, authorEmail: (await findUserById(comment.authorId))?.email ?? comment.authorId };
}

export async function listTaskCommentsForUser(userId: string, taskId: string): Promise<ListTaskCommentsOutcome> {
  const task = await findTaskById(taskId);
  if (!task || task.deletedAt !== null) {
    return { status: "not_found" };
  }

  const list = await findListById(task.listId);
  if (!list || list.deletedAt !== null || !canViewList(list, userId)) {
    return { status: "not_found" };
  }

  const comments = await listCommentsForTask(taskId);
  return { status: "ok", comments: await Promise.all(comments.map(toCommentWithAuthor)) };
}
