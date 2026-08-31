"use client";

import { useState } from "react";
import type { SavedFilter } from "@/entities/saved-filter/schema";
import { normalizeTaskFilterCriteria, safeParseSavedFilterQuery, type TaskFilterCriteria } from "@/entities/saved-filter/query-schema";
import { usePagedItems } from "@/shared/lib/use-paged-items";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { PaginationBar } from "@/shared/ui/pagination";

interface SavedFiltersPanelProps {
  recent: SavedFilter[];
  saved: SavedFilter[];
  isLoading: boolean;
  error: string | null;
  onApplyFilter: (id: string, criteria: TaskFilterCriteria) => void;
  onSaveFilter: (label: string | null) => void;
  onDeleteFilter: (id: string) => void;
}

function describeCriteria(criteria: TaskFilterCriteria): string {
  const parts: string[] = [];
  if (criteria.search !== "") parts.push(`Поиск: «${criteria.search}»`);
  if (criteria.status.length > 0) parts.push(`Статус: ${criteria.status.join(", ")}`);
  if (criteria.category !== null) parts.push(`Категория: ${criteria.category}`);
  if (criteria.tags.length > 0) parts.push(`Теги: ${criteria.tags.join(", ")}`);
  if (criteria.priorityMin !== null || criteria.priorityMax !== null) {
    parts.push(`Приоритет: ${criteria.priorityMin ?? "…"}–${criteria.priorityMax ?? "…"}`);
  }
  if (criteria.deadlineFrom !== null || criteria.deadlineTo !== null) {
    parts.push("Дедлайн: диапазон задан");
  }
  return parts.length > 0 ? parts.join(" · ") : "Без условий";
}

function FilterList({
  filters,
  onApplyFilter,
  onDeleteFilter,
  paginationTestId,
}: {
  filters: SavedFilter[];
  onApplyFilter: (id: string, criteria: TaskFilterCriteria) => void;
  onDeleteFilter?: (id: string) => void;
  paginationTestId?: string;
}) {
  const { page, setPage, totalPages, pageItems } = usePagedItems(filters);

  return (
    <div className="flex flex-col gap-2">
    <ul className="flex flex-col gap-1.5">
      {pageItems.map((filter) => {
        const query = safeParseSavedFilterQuery(filter);
        if (!query) {
          return null;
        }
        return (
          <li key={filter.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
            <span className="min-w-0 break-words text-muted-foreground">{query.label ?? describeCriteria(query)}</span>
            <div className="flex shrink-0 gap-1.5">
              <Button
                type="button"
                size="xs"
                variant="outline"
                data-testid={`saved-filter-apply-${filter.id}`}
                onClick={() => onApplyFilter(filter.id, normalizeTaskFilterCriteria(query))}
              >
                Применить
              </Button>
              {onDeleteFilter && (
                <Button
                  type="button"
                  size="xs"
                  variant="destructive"
                  data-testid={`saved-filter-delete-${filter.id}`}
                  onClick={() => onDeleteFilter(filter.id)}
                >
                  Удалить
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
      <PaginationBar
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        data-testid={paginationTestId}
      />
    </div>
  );
}

export function SavedFiltersPanel({
  recent,
  saved,
  isLoading,
  error,
  onApplyFilter,
  onSaveFilter,
  onDeleteFilter,
}: SavedFiltersPanelProps) {
  const [label, setLabel] = useState("");

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="saved-filters-loading">
        Загрузка фильтров…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {error && (
        <p className="text-sm text-destructive" data-testid="saved-filters-error">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="saved-filters-save-label" className="text-xs font-medium text-muted-foreground">
            Сохранить текущий фильтр как…
          </Label>
          <Input
            id="saved-filters-save-label"
            data-testid="saved-filters-save-label"
            placeholder="Название (опционально)"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="h-8"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="saved-filters-save"
          onClick={() => onSaveFilter(label.trim() === "" ? null : label.trim())}
        >
          Сохранить
        </Button>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Недавние</h3>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">Пока нет недавних фильтраций</p>
        ) : (
          <div data-testid="saved-filters-recent">
            <FilterList filters={recent} onApplyFilter={onApplyFilter} />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Сохранённые</h3>
        {saved.length === 0 ? (
          <p className="text-xs text-muted-foreground">Нет сохранённых фильтров</p>
        ) : (
          <div data-testid="saved-filters-saved">
            <FilterList
              filters={saved}
              onApplyFilter={onApplyFilter}
              onDeleteFilter={onDeleteFilter}
              paginationTestId="saved-filters-pagination"
            />
          </div>
        )}
      </div>
    </div>
  );
}
