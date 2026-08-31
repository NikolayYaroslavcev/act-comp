"use client";

import { useCallback, useRef, useState } from "react";
import type { CreateListInput } from "@/entities/list/requests";
import type { TaskList } from "@/entities/list/schema";

const VALIDATION_ERROR_MESSAGE = "Проверьте правильность заполнения полей";
const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const NETWORK_ERROR_MESSAGE = "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

const STATUS_MESSAGES: Record<number, string> = {
  400: VALIDATION_ERROR_MESSAGE,
  401: SESSION_EXPIRED_MESSAGE,
};

export interface UseCreateListResult {
  createList: (input: CreateListInput) => Promise<TaskList | null>;
  isPending: boolean;
  error: string | null;
}

/**
 * Client-side wrapper around `POST /api/lists`. Owns request state
 * (pending/error) only — validation and ownership stay on the server, this
 * just relays the outcome.
 */
export function useCreateList(): UseCreateListResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPendingRef = useRef(false);

  const createList = useCallback(async (input: CreateListInput): Promise<TaskList | null> => {
    if (isPendingRef.current) {
      return null;
    }

    isPendingRef.current = true;
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
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

  return { createList, isPending, error };
}
