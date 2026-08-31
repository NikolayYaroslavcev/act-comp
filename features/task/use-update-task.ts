"use client";

import { useCallback } from "react";
import type { UpdateTaskInput } from "@/entities/task/requests";
import { useUpdateTaskMutation, type UpdateTaskResult } from "@/features/task/tasks-api";

export interface UseUpdateTaskResult {
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<UpdateTaskResult | null>;
  isPending: boolean;
  error: string | null;
}

const VALIDATION_ERROR_MESSAGE = "Проверьте правильность заполнения полей";
const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const FORBIDDEN_MESSAGE = "У вас нет прав на редактирование этой задачи";
const NOT_FOUND_MESSAGE = "Задача недоступна или была удалена";
const CYCLE_MESSAGE = "Изменение создаёт цикл зависимостей. Проверьте выбранные зависимости";
const BLOCKED_MESSAGE = "Нельзя завершить задачу: сначала завершите задачи, от которых она зависит";
const NETWORK_ERROR_MESSAGE = "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

function statusOf(error: unknown): number | "FETCH_ERROR" | undefined {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status: number | "FETCH_ERROR" }).status;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  switch (statusOf(error)) {
    case 400:
      return VALIDATION_ERROR_MESSAGE;
    case 401:
      return SESSION_EXPIRED_MESSAGE;
    case 403:
      return FORBIDDEN_MESSAGE;
    case 404:
      return NOT_FOUND_MESSAGE;
    case 409:
      return CYCLE_MESSAGE;
    case 422:
      return BLOCKED_MESSAGE;
    case "FETCH_ERROR":
      return NETWORK_ERROR_MESSAGE;
    default:
      return UNEXPECTED_ERROR_MESSAGE;
  }
}

/**
 * Validation, permissions, and cycle detection stay on the server; this
 * just relays the outcome. Internally backed by tasksApi.updateTask.
 * TaskDetail still owns
 * the displayed task via props/`onTaskUpdated`; this hook only reports the
 * resolved or rejected PATCH.
 */
export function useUpdateTask(): UseUpdateTaskResult {
  const [trigger, { isLoading, error: mutationError }] = useUpdateTaskMutation();

  const updateTask = useCallback(
    async (taskId: string, input: UpdateTaskInput): Promise<UpdateTaskResult | null> => {
      try {
        return await trigger({ id: taskId, patch: input }).unwrap();
      } catch {
        return null;
      }
    },
    [trigger],
  );

  const error = mutationError ? errorMessage(mutationError) : null;

  return { updateTask, isPending: isLoading, error };
}
