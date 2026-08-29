"use client";

import { useCallback, useRef, useState } from "react";
import type { Task } from "@/entities/task/schema";

const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const FORBIDDEN_MESSAGE = "У вас нет прав на клонирование этой задачи";
const NOT_FOUND_MESSAGE = "Задача недоступна или была удалена";
const NETWORK_ERROR_MESSAGE =
  "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

export interface UseCloneTaskResult {
  cloneTask: (taskId: string) => Promise<Task | null>;
  isPending: boolean;
  error: string | null;
}

/**
 * Client-side wrapper around `POST /api/tasks/:id/clone`. Owns request state
 * (pending/error) only — permissions and clone semantics stay on the server,
 * this just relays the outcome.
 */
export function useCloneTask(): UseCloneTaskResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPendingRef = useRef(false);

  const cloneTask = useCallback(async (taskId: string): Promise<Task | null> => {
    if (isPendingRef.current) {
      return null;
    }

    isPendingRef.current = true;
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/clone`, { method: "POST" });

      if (response.status === 401) {
        setError(SESSION_EXPIRED_MESSAGE);
        return null;
      }

      if (response.status === 403) {
        setError(FORBIDDEN_MESSAGE);
        return null;
      }

      if (response.status === 404) {
        setError(NOT_FOUND_MESSAGE);
        return null;
      }

      if (!response.ok) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return null;
      }

      const json = (await response.json().catch(() => null)) as { data?: Task } | null;
      if (!json?.data) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return null;
      }

      return json.data;
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
      return null;
    } finally {
      isPendingRef.current = false;
      setIsPending(false);
    }
  }, []);

  return { cloneTask, isPending, error };
}
