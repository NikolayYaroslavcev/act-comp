"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CommentWithAuthor } from "@/entities/comment/dto";

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

/**
 * Client-side wrapper around GET/POST `/api/tasks/:id/comments`. Owns
 * request state (loading/pending/error) and the loaded list only —
 * permissions and validation stay on the server, this just relays the
 * outcome and appends what the server returns.
 */
export function useTaskComments(taskId: string): UseTaskCommentsResult {
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(`/api/tasks/${taskId}/comments`);
        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          setLoadError(LOAD_SESSION_EXPIRED_MESSAGE);
          return;
        }
        if (response.status === 404) {
          setLoadError(LOAD_NOT_FOUND_MESSAGE);
          return;
        }
        if (!response.ok) {
          setLoadError(LOAD_UNEXPECTED_ERROR_MESSAGE);
          return;
        }

        const json = (await response.json().catch(() => null)) as { data?: unknown } | null;
        if (!json || !Array.isArray(json.data)) {
          setLoadError(LOAD_UNEXPECTED_ERROR_MESSAGE);
          return;
        }

        setComments(json.data as CommentWithAuthor[]);
      } catch {
        if (!cancelled) {
          setLoadError(LOAD_NETWORK_ERROR_MESSAGE);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const addComment = useCallback(
    async (text: string): Promise<boolean> => {
      if (isSubmittingRef.current) {
        return false;
      }

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const response = await fetch(`/api/tasks/${taskId}/comments`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (response.status === 401) {
          setSubmitError(SUBMIT_SESSION_EXPIRED_MESSAGE);
          return false;
        }
        if (response.status === 403) {
          setSubmitError(SUBMIT_FORBIDDEN_MESSAGE);
          return false;
        }
        if (response.status === 404) {
          setSubmitError(SUBMIT_NOT_FOUND_MESSAGE);
          return false;
        }
        if (response.status === 400) {
          setSubmitError(SUBMIT_VALIDATION_ERROR_MESSAGE);
          return false;
        }
        if (!response.ok) {
          setSubmitError(SUBMIT_UNEXPECTED_ERROR_MESSAGE);
          return false;
        }

        const json = (await response.json().catch(() => null)) as { data?: CommentWithAuthor } | null;
        if (!json?.data) {
          setSubmitError(SUBMIT_UNEXPECTED_ERROR_MESSAGE);
          return false;
        }

        setComments((current) => [...current, json.data!]);
        return true;
      } catch {
        setSubmitError(SUBMIT_NETWORK_ERROR_MESSAGE);
        return false;
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [taskId],
  );

  return { comments, isLoading, loadError, addComment, isSubmitting, submitError };
}
