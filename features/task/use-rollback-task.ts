"use client";

import { useCallback, useRef, useState } from "react";
import type { CascadeUpdate } from "@/entities/task/model";
import type { Task } from "@/entities/task/schema";

const VALIDATION_ERROR_MESSAGE = "Нельзя восстановить выбранную версию";
const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const FORBIDDEN_MESSAGE = "У вас нет прав на редактирование этой задачи";
const NOT_FOUND_MESSAGE = "Задача недоступна или была удалена";
const CYCLE_MESSAGE = "Изменение создаёт цикл зависимостей. Проверьте выбранные зависимости";
const BLOCKED_MESSAGE = "Нельзя завершить задачу: сначала завершите задачи, от которых она зависит";
const NETWORK_ERROR_MESSAGE = "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

interface RollbackTaskResult {
  task: Task;
  cascade: CascadeUpdate[];
}

export interface UseRollbackTaskResult {
  rollbackTask: (taskId: string, historyIndex: number) => Promise<RollbackTaskResult | null>;
  isPending: boolean;
  error: string | null;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: VALIDATION_ERROR_MESSAGE,
  401: SESSION_EXPIRED_MESSAGE,
  403: FORBIDDEN_MESSAGE,
  404: NOT_FOUND_MESSAGE,
  409: CYCLE_MESSAGE,
  422: BLOCKED_MESSAGE,
};

export function useRollbackTask(): UseRollbackTaskResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPendingRef = useRef(false);

  const rollbackTask = useCallback(async (taskId: string, historyIndex: number): Promise<RollbackTaskResult | null> => {
    if (isPendingRef.current) {
      return null;
    }

    isPendingRef.current = true;
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/rollback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ historyIndex }),
      });

      const knownMessage = STATUS_MESSAGES[response.status];
      if (knownMessage) {
        setError(knownMessage);
        return null;
      }

      if (!response.ok) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return null;
      }

      const json = (await response.json().catch(() => null)) as { data?: RollbackTaskResult } | null;
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

  return { rollbackTask, isPending, error };
}
