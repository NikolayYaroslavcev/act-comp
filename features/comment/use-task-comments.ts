"use client";

import { useCallback, useRef, useState } from "react";
import type { CommentWithAuthor } from "@/entities/comment/dto";
import { useCreateTaskCommentMutation, useGetTaskCommentsQuery } from "@/features/comment/comments-api";

// Every message here is worded to never exactly match the generic
// task-level hook messages (useUpdateTask/useCloneTask) — the comments
// section can show its own error at the same time as a task-level one (e.g.
// the Clone error banner), and identical text on screen twice breaks
// `getByText`/`findByText`'s single-match assumption.
const LOAD_SESSION_EXPIRED_MESSAGE = "Комментарии: сессия истекла. Войдите снова";
const LOAD_NOT_FOUND_MESSAGE = "Комментарии: задача недоступна или была удалена";
const LOAD_NETWORK_ERROR_MESSAGE = "Комментарии: нет соединения с сервером. Проверьте подключение к интернету";
const LOAD_UNEXPECTED_ERROR_MESSAGE = "Комментарии: не удалось загрузить. Попробуйте ещё раз";

const SUBMIT_SESSION_EXPIRED_MESSAGE = "Не удалось отправить комментарий: сессия истекла. Войдите снова";
const SUBMIT_FORBIDDEN_MESSAGE = "У вас нет прав добавлять комментарии к этой задаче";
const SUBMIT_NOT_FOUND_MESSAGE = "Не удалось отправить комментарий: задача недоступна или была удалена";
const SUBMIT_VALIDATION_ERROR_MESSAGE = "Комментарий не может быть пустым";
const SUBMIT_NETWORK_ERROR_MESSAGE = "Не удалось отправить комментарий: нет соединения с сервером";
const SUBMIT_UNEXPECTED_ERROR_MESSAGE = "Не удалось отправить комментарий. Попробуйте ещё раз";

export interface UseTaskCommentsResult {
  comments: CommentWithAuthor[];
  isLoading: boolean;
  loadError: string | null;
  addComment: (text: string) => Promise<boolean>;
  isSubmitting: boolean;
  submitError: string | null;
}

function statusOf(error: unknown): number | "FETCH_ERROR" | undefined {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status: number | "FETCH_ERROR" }).status;
  }
  return undefined;
}

function loadErrorMessage(error: unknown): string {
  const status = statusOf(error);
  if (status === 401) return LOAD_SESSION_EXPIRED_MESSAGE;
  if (status === 404) return LOAD_NOT_FOUND_MESSAGE;
  if (status === "FETCH_ERROR") return LOAD_NETWORK_ERROR_MESSAGE;
  return LOAD_UNEXPECTED_ERROR_MESSAGE;
}

function submitErrorMessage(error: unknown): string {
  const status = statusOf(error);
  if (status === 401) return SUBMIT_SESSION_EXPIRED_MESSAGE;
  if (status === 403) return SUBMIT_FORBIDDEN_MESSAGE;
  if (status === 404) return SUBMIT_NOT_FOUND_MESSAGE;
  if (status === 400) return SUBMIT_VALIDATION_ERROR_MESSAGE;
  if (status === "FETCH_ERROR") return SUBMIT_NETWORK_ERROR_MESSAGE;
  return SUBMIT_UNEXPECTED_ERROR_MESSAGE;
}

/**
 * Permissions and validation stay server-side; this only relays the
 * query/mutation outcome. The double-submit guard stays explicit (a ref,
 * not RTK Query dedup) because
 * RTK Query dedupes identical in-flight *queries*, not mutations — two
 * addComment calls in flight are two distinct POSTs unless guarded here.
 */
export function useTaskComments(taskId: string): UseTaskCommentsResult {
  const { data, isLoading, error: queryError } = useGetTaskCommentsQuery(taskId);
  const [createComment] = useCreateTaskCommentMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const comments = data ?? [];
  const loadError = queryError ? loadErrorMessage(queryError) : null;

  const addComment = useCallback(
    async (text: string): Promise<boolean> => {
      if (isSubmittingRef.current) {
        return false;
      }

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        await createComment({ taskId, text }).unwrap();
        return true;
      } catch (error) {
        setSubmitError(submitErrorMessage(error));
        return false;
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [createComment, taskId],
  );

  return { comments, isLoading, loadError, addComment, isSubmitting, submitError };
}
