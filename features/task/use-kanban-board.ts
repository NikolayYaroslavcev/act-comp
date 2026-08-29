"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, TaskStatus } from "@/entities/task/schema";
import { requestUpdateTask } from "@/features/task/update-task-request";

export interface UseKanbanBoardOptions {
  onTaskUpdated?: (task: Task) => void;
}

export interface UseKanbanBoardResult {
  statusOverrides: Record<string, TaskStatus>;
  pendingTaskIds: Set<string>;
  errorsByTaskId: Record<string, string>;
  moveTask: (taskId: string, status: TaskStatus) => void;
  dismissError: (taskId: string) => void;
}

export function useKanbanBoard(options: UseKanbanBoardOptions = {}): UseKanbanBoardResult {
  const onTaskUpdatedRef = useRef(options.onTaskUpdated);
  useEffect(() => {
    onTaskUpdatedRef.current = options.onTaskUpdated;
  }, [options.onTaskUpdated]);

  const [statusOverrides, setStatusOverrides] = useState<Record<string, TaskStatus>>({});
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(() => new Set());
  const [errorsByTaskId, setErrorsByTaskId] = useState<Record<string, string>>({});

  const dismissError = useCallback((taskId: string) => {
    setErrorsByTaskId((current) => {
      if (!(taskId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  }, []);

  const moveTask = useCallback((taskId: string, status: TaskStatus) => {
    setStatusOverrides((current) => ({ ...current, [taskId]: status }));
    setPendingTaskIds((current) => {
      const next = new Set(current);
      next.add(taskId);
      return next;
    });
    setErrorsByTaskId((current) => {
      if (!(taskId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[taskId];
      return next;
    });

    void requestUpdateTask(taskId, { status }).then((result) => {
      setStatusOverrides((current) => {
        if (!(taskId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[taskId];
        return next;
      });
      setPendingTaskIds((current) => {
        if (!current.has(taskId)) {
          return current;
        }
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });

      if (result.status === "ok") {
        onTaskUpdatedRef.current?.(result.task);
        return;
      }

      setErrorsByTaskId((current) => ({ ...current, [taskId]: result.message }));
    });
  }, []);

  return { statusOverrides, pendingTaskIds, errorsByTaskId, moveTask, dismissError };
}
