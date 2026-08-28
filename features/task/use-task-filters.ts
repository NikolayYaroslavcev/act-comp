"use client";

import { useMemo, useState } from "react";
import type { Task } from "@/entities/task/schema";
import { applyTaskQuery, type TaskFilters } from "@/entities/task/model";
import { EMPTY_TASK_FILTER_CRITERIA, type TaskFilterCriteria } from "@/entities/saved-filter/query-schema";

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
 * Draft vs applied is deliberate: typing/toggling controls only updates
 * `draft` (cheap, local), and filteredTasks/appliedSearch — the things
 * that drive re-rendering the task list and recording a recent filter —
 * only change on an explicit apply()/clear()/restore().
 */
export function useTaskFilters(tasks: Task[]): UseTaskFiltersResult {
  const [draft, setDraft] = useState<TaskFilterCriteria>(EMPTY_TASK_FILTER_CRITERIA);
  const [applied, setApplied] = useState<TaskFilterCriteria>(EMPTY_TASK_FILTER_CRITERIA);

  const filteredTasks = useMemo(
    () => applyTaskQuery(tasks, { search: applied.search, filters: toTaskFilters(applied) }),
    [tasks, applied],
  );

  return {
    draft,
    setDraft,
    apply: () => setApplied(draft),
    clear: () => {
      setDraft(EMPTY_TASK_FILTER_CRITERIA);
      setApplied(EMPTY_TASK_FILTER_CRITERIA);
    },
    restore: (criteria) => {
      setDraft(criteria);
      setApplied(criteria);
    },
    filteredTasks,
    appliedSearch: applied.search,
  };
}
