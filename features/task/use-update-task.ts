"use client";

import { useCallback, useState } from "react";
import type { UpdateTaskInput } from "@/entities/task/requests";
import type { Task } from "@/entities/task/schema";
import type { CascadeUpdate } from "@/entities/task/model";
import { requestUpdateTask } from "@/features/task/update-task-request";

export interface UpdateTaskResult {
  task: Task;
  cascade: CascadeUpdate[];
}

export interface UseUpdateTaskResult {
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<UpdateTaskResult | null>;
  isPending: boolean;
  error: string | null;
}

/**
 * Client-side wrapper around `PATCH /api/tasks/:id`. Owns request state
 * (pending/error) only — validation, permissions, and cycle detection stay
 * on the server, this just relays the outcome.
 */
export function useUpdateTask(): UseUpdateTaskResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateTask = useCallback(
    async (taskId: string, input: UpdateTaskInput): Promise<UpdateTaskResult | null> => {
      setIsPending(true);
      setError(null);

      const result = await requestUpdateTask(taskId, input);
      setIsPending(false);

      if (result.status === "error") {
        setError(result.message);
        return null;
      }

      return { task: result.task, cascade: result.cascade };
    },
    [],
  );

  return { updateTask, isPending, error };
}
