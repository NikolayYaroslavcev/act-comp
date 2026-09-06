"use client";

import { useCallback, useRef, useState } from "react";
import type { CreateTaskInput } from "@/entities/task/requests";
import type { Task } from "@/entities/task/schema";

const VALIDATION_ERROR_MESSAGE = "Проверьте правильность заполнения полей";
const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const FORBIDDEN_MESSAGE = "У вас нет прав на создание задач в этом списке";
const NOT_FOUND_MESSAGE = "Список недоступен или был удалён";
const NETWORK_ERROR_MESSAGE = "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

const STATUS_MESSAGES: Record<number, string> = {
  400: VALIDATION_ERROR_MESSAGE,
  401: SESSION_EXPIRED_MESSAGE,
  403: FORBIDDEN_MESSAGE,
  404: NOT_FOUND_MESSAGE,
};

export interface UseCreateTaskResult {
  createTask: (input: CreateTaskInput) => Promise<Task | null>;
  isPending: boolean;
  error: string | null;
}

/**
 * Client-side wrapper around `POST /api/tasks`. Owns request state
 * (pending/error) only — validation and permissions stay on the server,
 * this just relays the outcome.
 */
export function useCreateTask(): UseCreateTaskResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPendingRef = useRef(false);

  const createTask = useCallback(async (input: CreateTaskInput): Promise<Task | null> => {
    if (isPendingRef.current) {
      return null;
    }

    isPendingRef.current = true;
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/tasks", {
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

  return { createTask, isPending, error };
}
