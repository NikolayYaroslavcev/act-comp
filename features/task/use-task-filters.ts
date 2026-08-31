"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/entities/task/schema";
import { applyTaskQuery, type TaskFilters } from "@/entities/task/model";
import { EMPTY_TASK_FILTER_CRITERIA, normalizeTaskFilterCriteria, type TaskFilterCriteria } from "@/entities/saved-filter/query-schema";

function toTaskFilters(criteria: TaskFilterCriteria): TaskFilters {
  return {
    status: criteria.status,
    category: criteria.category ?? undefined,
    tags: criteria.tags,
    priorityMin: criteria.priorityMin ?? undefined,
    priorityMax: criteria.priorityMax ?? undefined,
    deadlineFrom: criteria.deadlineFrom ?? undefined,
    deadlineTo: criteria.deadlineTo ?? undefined,
  };
}

export const TASK_SEARCH_DEBOUNCE_MS = 350;

export interface UseTaskFiltersResult {
  draft: TaskFilterCriteria;
  setDraft: (criteria: TaskFilterCriteria) => void;
  apply: () => void;
  clear: () => void;
  restore: (criteria: TaskFilterCriteria) => void;
  filteredTasks: Task[];
  appliedSearch: string;
}

/**
 * Structured filters stay draft-until-apply. Text search applies after a
 * short debounce so keypresses do not recompute the list on every character.
 * Apply/clear/restore still apply immediately and cancel a pending search timer.
 */
export function useTaskFilters(tasks: Task[]): UseTaskFiltersResult {
  const [draft, setDraft] = useState<TaskFilterCriteria>(EMPTY_TASK_FILTER_CRITERIA);
  const [applied, setApplied] = useState<TaskFilterCriteria>(EMPTY_TASK_FILTER_CRITERIA);

  const filteredTasks = useMemo(
    () => applyTaskQuery(tasks, { search: applied.search, filters: toTaskFilters(applied) }),
    [tasks, applied],
  );

  useEffect(() => {
    if (draft.search === applied.search) {
      return;
    }

    const timer = window.setTimeout(() => {
      setApplied((current) =>
        current.search === draft.search ? current : { ...current, search: draft.search },
      );
    }, TASK_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [applied.search, draft.search]);

  return {
    draft,
    setDraft,
    apply: () => setApplied(draft),
    clear: () => {
      setDraft(EMPTY_TASK_FILTER_CRITERIA);
      setApplied(EMPTY_TASK_FILTER_CRITERIA);
    },
    restore: (criteria) => {
      const next = normalizeTaskFilterCriteria(criteria);
      setDraft(next);
      setApplied(next);
    },
    filteredTasks,
    appliedSearch: applied.search,
  };
}
