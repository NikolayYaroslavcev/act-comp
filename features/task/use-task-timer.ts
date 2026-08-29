"use client";

import { useCallback, useRef, useState } from "react";
import type { TimerAction } from "@/entities/task/requests";
import type { Task } from "@/entities/task/schema";
import { requestControlTaskTimer } from "@/features/task/control-task-timer-request";

export interface UseTaskTimerResult {
  controlTimer: (taskId: string, action: TimerAction) => Promise<Task | null>;
  isPending: boolean;
  error: string | null;
}

export function useTaskTimer(): UseTaskTimerResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPendingRef = useRef(false);

  const controlTimer = useCallback(async (taskId: string, action: TimerAction): Promise<Task | null> => {
    if (isPendingRef.current) {
      return null;
    }

    isPendingRef.current = true;
    setIsPending(true);
    setError(null);

    try {
      const result = await requestControlTaskTimer(taskId, action);
      if (result.status === "error") {
        setError(result.message);
        return null;
      }
      return result.task;
    } finally {
      isPendingRef.current = false;
      setIsPending(false);
    }
  }, []);

  return { controlTimer, isPending, error };
}
