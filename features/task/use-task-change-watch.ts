"use client";

import { useCallback, useState } from "react";
import { useGetTaskChangesQuery } from "@/features/task/task-changes-api";

export const TASK_CHANGE_POLL_MS = 15_000;

export interface UseTaskChangeWatchParams {
  taskId: string;
  enabled: boolean;
  /** Test-only override for the initial cursor; defaults to "now". */
  initialSince?: string;
}

export interface UseTaskChangeWatchResult {
  changed: boolean;
  actorEmail: string | null;
  summary: string | null;
  /** Advances the cursor past the currently reported change (call after refreshing/dismissing it). */
  acknowledge: () => void;
}

/**
 * Polls GET /api/tasks/:id/changes for other users' edits to one open task.
 * The `since` cursor only ever moves forward via acknowledge() (never on its
 * own), so a poll that finds a stale, already-acknowledged change can't loop
 * back into fetching/reporting it again.
 */
export function useTaskChangeWatch({
  taskId,
  enabled,
  initialSince,
}: UseTaskChangeWatchParams): UseTaskChangeWatchResult {
  const [since, setSince] = useState(() => initialSince ?? new Date().toISOString());

  const { data } = useGetTaskChangesQuery(
    { taskId, since },
    { pollingInterval: TASK_CHANGE_POLL_MS, skip: !enabled },
  );

  const acknowledge = useCallback(() => {
    setSince(new Date().toISOString());
  }, []);

  return {
    changed: data?.changed ?? false,
    actorEmail: data?.actorEmail ?? null,
    summary: data?.summary ?? null,
    acknowledge,
  };
}
