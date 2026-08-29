import { findListById } from "@/entities/list/repository";
import { canViewList } from "@/entities/list/model";
import { findTaskById } from "@/entities/task/repository";
import { listCommentsForTask } from "@/entities/comment/repository";
import { findUserById } from "@/entities/user/repository";
import type { Comment } from "@/entities/comment/schema";
import type { CommentWithAuthor } from "@/entities/comment/dto";

export type ListTaskCommentsOutcome = { status: "not_found" } | { status: "ok"; comments: CommentWithAuthor[] };

function toCommentWithAuthor(comment: Comment): CommentWithAuthor {
  return { ...comment, authorEmail: findUserById(comment.authorId)?.email ?? comment.authorId };
}

export function listTaskCommentsForUser(userId: string, taskId: string): ListTaskCommentsOutcome {
  const task = findTaskById(taskId);
  if (!task || task.deletedAt !== null) {
    return { status: "not_found" };
  }

  const list = findListById(task.listId);
  if (!list || list.deletedAt !== null || !canViewList(list, userId)) {
    return { status: "not_found" };
  }

  return { status: "ok", comments: listCommentsForTask(taskId).map(toCommentWithAuthor) };
}
