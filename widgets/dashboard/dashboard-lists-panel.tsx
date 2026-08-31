"use client";

import { useCallback, useState } from "react";
import type { DashboardListSummary, DeletedListSummary } from "@/features/dashboard/dashboard-lists";
import { calculateListUrgency } from "@/entities/list/model";
import type { TaskList } from "@/entities/list/schema";
import { areListFilterCriteriaEqual, EMPTY_LIST_FILTER_CRITERIA, type ListFilterCriteria } from "@/entities/saved-filter/list-query-schema";
import { useListFilters } from "@/features/dashboard/use-list-filters";
import { useSavedFilters } from "@/features/saved-filter/use-saved-filters";
import { CreateListDialog } from "./create-list-dialog";
import { DeletedListsSection } from "./deleted-lists-section";
import { ListFilters } from "./list-filters";
import { ListSavedFiltersPanel } from "./list-saved-filters-panel";
import { ListsSection } from "./lists-section";

interface DashboardListsPanelProps {
  initialLists: DashboardListSummary[];
  initialDeletedLists?: DeletedListSummary[];
}

function toDashboardListSummary(list: TaskList): DashboardListSummary {
  return {
    id: list.id,
    title: list.title,
    template: list.template,
    deadline: list.deadline,
    taskCount: 0,
    statusCounts: { new: 0, in_progress: 0, done: 0 },
    overdueCount: 0,
    progress: 0,
    urgency: calculateListUrgency(list, []),
    isArchiveCandidate: false,
    lastActivityAt: list.lastActivityAt,
    priority: 0,
    canDelete: true,
    canEdit: true,
  };
}

export function DashboardListsPanel({ initialLists, initialDeletedLists = [] }: DashboardListsPanelProps) {
  const [lists, setLists] = useState(initialLists);
  const [deletedLists, setDeletedLists] = useState(initialDeletedLists);
  const { draft, setDraft, apply, clear, restore, filteredLists, applied } = useListFilters(lists);
  const savedFilters = useSavedFilters<ListFilterCriteria>("lists");
  const isFiltered = !areListFilterCriteriaEqual(applied, EMPTY_LIST_FILTER_CRITERIA);

  function handleApply() {
    apply();
    void savedFilters.applyFilter(draft);
  }

  const handleCreated = useCallback((list: TaskList) => {
    setLists((current) => [toDashboardListSummary(list), ...current]);
  }, []);

  const handleDeleted = useCallback((deleted: TaskList) => {
    setLists((current) => current.filter((list) => list.id !== deleted.id));
    setDeletedLists((current) => [
      { id: deleted.id, title: deleted.title, deletedAt: deleted.deletedAt ?? new Date().toISOString() },
      ...current,
    ]);
  }, []);

  const handleUpdated = useCallback((updated: TaskList) => {
    setLists((current) =>
      current.map((list) =>
        list.id === updated.id
          ? { ...list, title: updated.title, template: updated.template, deadline: updated.deadline }
          : list,
      ),
    );
  }, []);

  const handleRestored = useCallback((list: TaskList) => {
    setDeletedLists((current) => current.filter((entry) => entry.id !== list.id));
    setLists((current) => [toDashboardListSummary(list), ...current]);
  }, []);

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex w-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Мои списки</h2>
          <CreateListDialog onCreated={handleCreated} />
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
          <ListFilters draft={draft} onDraftChange={setDraft} onApply={handleApply} onClear={clear} />

          <ListSavedFiltersPanel
            recent={savedFilters.recent}
            saved={savedFilters.saved}
            isLoading={savedFilters.isLoading}
            error={savedFilters.error}
            onApplyFilter={(id, criteria) => {
              restore(criteria);
              void savedFilters.touchFilter(id);
            }}
            onSaveFilter={(label) => void savedFilters.saveFilter(draft, label)}
            onDeleteFilter={(id) => void savedFilters.deleteFilter(id)}
          />
        </div>

        <ListsSection lists={filteredLists} onDeleted={handleDeleted} onUpdated={handleUpdated} isFiltered={isFiltered} />
      </div>
      <DeletedListsSection lists={deletedLists} onRestored={handleRestored} />
    </div>
  );
}
