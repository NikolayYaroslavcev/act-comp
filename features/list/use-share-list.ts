"use client";

import { useCallback, useRef, useState } from "react";
import type { ShareListInput } from "@/entities/list/requests";
import type { TaskList } from "@/entities/list/schema";

const VALIDATION_ERROR_MESSAGE = "Проверьте правильность заполнения полей";
const SELF_SHARE_MESSAGE = "Нельзя выдать доступ самому себе";
const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const FORBIDDEN_MESSAGE = "Только владелец может управлять доступом к этому списку";
const SHARE_TARGET_MESSAGE = "Не удалось выдать доступ указанному пользователю";
const LIST_NOT_FOUND_MESSAGE = "Список не найден";
const CONFLICT_MESSAGE = "Конфликт: не удалось обновить доступ";
const NETWORK_ERROR_MESSAGE = "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

type ErrorBody = { error?: { message?: string }; data?: TaskList };

function messageForStatus(status: number, body: ErrorBody | null): string {
  const serverMessage = body?.error?.message;

  if (status === 400 && serverMessage === "Unable to share this list with the specified user") {
    return SHARE_TARGET_MESSAGE;
  }
  if (status === 400 && serverMessage === "Cannot share a list with yourself") {
    return SELF_SHARE_MESSAGE;
  }
  if (status === 400) {
    return VALIDATION_ERROR_MESSAGE;
  }
  if (status === 401) {
    return SESSION_EXPIRED_MESSAGE;
  }
  if (status === 403) {
    return FORBIDDEN_MESSAGE;
  }
  if (status === 404) {
    return LIST_NOT_FOUND_MESSAGE;
  }
  if (status === 409) {
    return CONFLICT_MESSAGE;
  }
  return UNEXPECTED_ERROR_MESSAGE;
}

export interface UseShareListResult {
  shareList: (listId: string, input: ShareListInput) => Promise<TaskList | null>;
  isPending: boolean;
  error: string | null;
}

/**
 * Client-side wrapper around `POST /api/lists/:id/share`. Owns request
 * state only — owner checks and target-user resolution stay on the server.
 */
export function useShareList(): UseShareListResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPendingRef = useRef(false);

  const shareList = useCallback(async (listId: string, input: ShareListInput): Promise<TaskList | null> => {
    if (isPendingRef.current) {
      return null;
    }

    isPendingRef.current = true;
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/lists/${listId}/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });

      const json = (await response.json().catch(() => null)) as ErrorBody | null;

      if (!response.ok) {
        setError(messageForStatus(response.status, json));
        return null;
      }

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

  return { shareList, isPending, error };
}
