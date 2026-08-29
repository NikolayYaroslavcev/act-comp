"use client";

import { useState } from "react";
import type { SavedFilter } from "@/entities/saved-filter/schema";
import { parseSavedFilterQuery, type TaskFilterCriteria } from "@/entities/saved-filter/query-schema";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

interface SavedFiltersPanelProps {
  recent: SavedFilter[];
  saved: SavedFilter[];
  isLoading: boolean;
  error: string | null;
  onApplyFilter: (criteria: TaskFilterCriteria) => void;
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
}: {
  filters: SavedFilter[];
  onApplyFilter: (criteria: TaskFilterCriteria) => void;
  onDeleteFilter?: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {filters.map((filter) => {
        const query = parseSavedFilterQuery(filter);
        return (
          <li key={filter.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
            <span className="min-w-0 break-words">{query.label ?? describeCriteria(query)}</span>
            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" variant="outline" data-testid={`saved-filter-apply-${filter.id}`} onClick={() => onApplyFilter(query)}>
                Применить
              </Button>
              {onDeleteFilter && (
                <Button
                  size="sm"
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

  if (error) {
    return (
      <p className="text-sm text-destructive" data-testid="saved-filters-error">
        {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="saved-filters-save-label">Название фильтра (опционально)</Label>
          <Input
            id="saved-filters-save-label"
            data-testid="saved-filters-save-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <Button data-testid="saved-filters-save" onClick={() => onSaveFilter(label.trim() === "" ? null : label.trim())}>
          Сохранить фильтр
        </Button>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm font-medium">Недавние</h3>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">Пока нет недавних фильтраций</p>
        ) : (
          <div data-testid="saved-filters-recent">
            <FilterList filters={recent} onApplyFilter={onApplyFilter} />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm font-medium">Сохранённые</h3>
        {saved.length === 0 ? (
          <p className="text-xs text-muted-foreground">Нет сохранённых фильтров</p>
        ) : (
          <div data-testid="saved-filters-saved">
            <FilterList filters={saved} onApplyFilter={onApplyFilter} onDeleteFilter={onDeleteFilter} />
          </div>
        )}
      </div>
    </div>
  );
}
