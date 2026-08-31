"use client";

import { useEffect, useMemo, useState } from "react";
import { applyListQuery, type ListFilters } from "@/entities/list/model";
import {
  EMPTY_LIST_FILTER_CRITERIA,
  normalizeListFilterCriteria,
  type ListFilterCriteria,
} from "@/entities/saved-filter/list-query-schema";
import type { DashboardListSummary } from "@/features/dashboard/dashboard-lists";

function toListFilters(criteria: ListFilterCriteria): ListFilters {
  return {
    template: criteria.template,
    deadlineFrom: criteria.deadlineFrom ?? undefined,
    deadlineTo: criteria.deadlineTo ?? undefined,
  };
}

export const LIST_SEARCH_DEBOUNCE_MS = 350;

export interface UseListFiltersResult {
  draft: ListFilterCriteria;
  setDraft: (criteria: ListFilterCriteria) => void;
  apply: () => void;
  clear: () => void;
  restore: (criteria: ListFilterCriteria) => void;
  filteredLists: DashboardListSummary[];
  appliedSearch: string;
  applied: ListFilterCriteria;
}

/**
 * Same draft-until-apply + debounced-search shape as useTaskFilters
 * (features/task/use-task-filters.ts), applied to the dashboard's list
 * summaries instead of tasks. Filtering happens purely client-side over
 * lists the server already scoped to the current user (getDashboardLists ->
 * selectVisibleLists), so it can never surface a list the caller couldn't
 * already see.
 */
export function useListFilters(lists: DashboardListSummary[]): UseListFiltersResult {
  const [draft, setDraft] = useState<ListFilterCriteria>(EMPTY_LIST_FILTER_CRITERIA);
  const [applied, setApplied] = useState<ListFilterCriteria>(EMPTY_LIST_FILTER_CRITERIA);

  const filteredLists = useMemo(
    () => applyListQuery(lists, { search: applied.search, filters: toListFilters(applied) }),
    [lists, applied],
  );

  useEffect(() => {
    if (draft.search === applied.search) {
      return;
    }

    const timer = window.setTimeout(() => {
      setApplied((current) => (current.search === draft.search ? current : { ...current, search: draft.search }));
    }, LIST_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [applied.search, draft.search]);

  return {
    draft,
    setDraft,
    apply: () => setApplied(draft),
    clear: () => {
      setDraft(EMPTY_LIST_FILTER_CRITERIA);
      setApplied(EMPTY_LIST_FILTER_CRITERIA);
    },
    restore: (criteria) => {
      const next = normalizeListFilterCriteria(criteria);
      setDraft(next);
      setApplied(next);
    },
    filteredLists,
    appliedSearch: applied.search,
    applied,
  };
}
