"use client";

import { useCallback } from "react";
import { useGetTaskActivityQuery } from "@/features/activity/activity-api";
import type { TaskActivityItem } from "@/entities/activity/dto";

const LOAD_SESSION_EXPIRED_MESSAGE = "История: сессия истекла. Войдите снова";
const LOAD_NOT_FOUND_MESSAGE = "История: задача недоступна или была удалена";
const LOAD_NETWORK_ERROR_MESSAGE = "История: нет соединения с сервером. Проверьте подключение к интернету";
const LOAD_UNEXPECTED_ERROR_MESSAGE = "История: не удалось загрузить. Попробуйте ещё раз";

export interface UseTaskActivityResult {
  activity: TaskActivityItem[];
  isLoading: boolean;
  loadError: string | null;
  reload: () => void;
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

/**
 * Backed by activityApi's getTaskActivity query — cache is keyed by taskId
 * and refreshed via the "Activity" RTK Query tag (invalidated by attachment
 * upload/delete, see use-task-attachments.ts), not by a caller-supplied
 * revision number.
 */
export function useTaskActivity(taskId: string): UseTaskActivityResult {
  const { data, isLoading, error: queryError, refetch } = useGetTaskActivityQuery(taskId);

  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    activity: data ?? [],
    isLoading,
    loadError: queryError ? loadErrorMessage(queryError) : null,
    reload,
  };
}
