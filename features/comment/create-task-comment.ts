import { findListById } from "@/entities/list/repository";
import { canEditList, canViewList } from "@/entities/list/model";
import { findTaskById } from "@/entities/task/repository";
import { createComment } from "@/entities/comment/repository";
import { findUserById } from "@/entities/user/repository";
import type { CreateCommentInput } from "@/entities/comment/requests";
import type { CommentWithAuthor } from "@/entities/comment/dto";

export type CreateTaskCommentOutcome =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; comment: CommentWithAuthor };

// Comments require edit access to the parent list, not merely view access —
// same reasoning as cloneTaskForUser (features/task/clone-task.ts): a
// comment is a mutation on the task, so it needs the write permission other
// task mutations require, not the read permission getVisibleTask allows.
export function createTaskCommentForUser(
  userId: string,
  taskId: string,
  input: CreateCommentInput,
): CreateTaskCommentOutcome {
  const task = findTaskById(taskId);
  if (!task || task.deletedAt !== null) {
    return { status: "not_found" };
  }

  const list = findListById(task.listId);
  if (!list || list.deletedAt !== null || !canViewList(list, userId)) {
    return { status: "not_found" };
  }

  if (!canEditList(list, userId)) {
    return { status: "forbidden" };
  }

  const comment = createComment({ taskId, authorId: userId, text: input.text });
  return { status: "ok", comment: { ...comment, authorEmail: findUserById(userId)?.email ?? userId } };
}
