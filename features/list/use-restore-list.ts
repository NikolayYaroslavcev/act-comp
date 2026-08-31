"use client";

import { useCallback, useRef, useState } from "react";
import type { TaskList } from "@/entities/list/schema";

const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const FORBIDDEN_MESSAGE = "У вас нет прав на восстановление этого списка";
const NOT_FOUND_MESSAGE = "Список не найден";
const RESTORE_WINDOW_EXPIRED_MESSAGE = "Срок восстановления списка (30 дней) истёк";
const NETWORK_ERROR_MESSAGE = "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

const STATUS_MESSAGES: Record<number, string> = {
  401: SESSION_EXPIRED_MESSAGE,
  403: FORBIDDEN_MESSAGE,
  404: NOT_FOUND_MESSAGE,
  409: RESTORE_WINDOW_EXPIRED_MESSAGE,
};

export interface UseRestoreListResult {
  restoreList: (listId: string) => Promise<TaskList | null>;
  isPending: boolean;
  error: string | null;
}

/**
 * Client-side wrapper around `POST /api/lists/:id/restore`. Owns request
 * state (pending/error) only — permission checks and the 30-day restore
 * window stay on the server, this just relays the outcome.
 */
export function useRestoreList(): UseRestoreListResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPendingRef = useRef(false);

  const restoreList = useCallback(async (listId: string): Promise<TaskList | null> => {
    if (isPendingRef.current) {
      return null;
    }

    isPendingRef.current = true;
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/lists/${listId}/restore`, { method: "POST" });

      const knownMessage = STATUS_MESSAGES[response.status];
      if (knownMessage) {
        setError(knownMessage);
        return null;
      }

      if (!response.ok) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return null;
      }

      const json = (await response.json().catch(() => null)) as { data?: TaskList } | null;
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

  return { restoreList, isPending, error };
}
