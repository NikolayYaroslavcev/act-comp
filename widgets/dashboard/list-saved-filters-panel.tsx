"use client";

import { useState } from "react";
import type { SavedFilter } from "@/entities/saved-filter/schema";
import {
  normalizeListFilterCriteria,
  safeParseSavedListFilterQuery,
  type ListFilterCriteria,
} from "@/entities/saved-filter/list-query-schema";
import { usePagedItems } from "@/shared/lib/use-paged-items";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { PaginationBar } from "@/shared/ui/pagination";

interface ListSavedFiltersPanelProps {
  recent: SavedFilter[];
  saved: SavedFilter[];
  isLoading: boolean;
  error: string | null;
  onApplyFilter: (id: string, criteria: ListFilterCriteria) => void;
  onSaveFilter: (label: string | null) => void;
  onDeleteFilter: (id: string) => void;
}

const TEMPLATE_LABELS: Record<string, string> = { work: "Работа", personal: "Личное", project: "Проект" };

function describeCriteria(criteria: ListFilterCriteria): string {
  const parts: string[] = [];
  if (criteria.search !== "") parts.push(`Поиск: «${criteria.search}»`);
  if (criteria.template.length > 0) {
    parts.push(`Шаблон: ${criteria.template.map((value) => TEMPLATE_LABELS[value] ?? value).join(", ")}`);
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
  onApplyFilter: (id: string, criteria: ListFilterCriteria) => void;
  onDeleteFilter?: (id: string) => void;
  paginationTestId?: string;
}) {
  const { page, setPage, totalPages, pageItems } = usePagedItems(filters);

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {pageItems.map((filter) => {
          const query = safeParseSavedListFilterQuery(filter);
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
                  onClick={() => onApplyFilter(filter.id, normalizeListFilterCriteria(query))}
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
      <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} data-testid={paginationTestId} />
    </div>
  );
}

/**
 * Same shape as widgets/list/saved-filters-panel.tsx, applied to list search
 * criteria instead of task criteria — kept as a sibling component (like
 * entities/saved-filter/list-query-schema.ts sits beside query-schema.ts)
 * rather than forcing one component to branch on scope internally.
 */
export function ListSavedFiltersPanel({
  recent,
  saved,
  isLoading,
  error,
  onApplyFilter,
  onSaveFilter,
  onDeleteFilter,
}: ListSavedFiltersPanelProps) {
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
          <Label htmlFor="list-saved-filters-save-label" className="text-xs font-medium text-muted-foreground">
            Сохранить текущий фильтр как…
          </Label>
          <Input
            id="list-saved-filters-save-label"
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

      {recent.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Недавние</h3>
          <div data-testid="saved-filters-recent">
            <FilterList filters={recent} onApplyFilter={onApplyFilter} />
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Сохранённые</h3>
          <div data-testid="saved-filters-saved">
            <FilterList
              filters={saved}
              onApplyFilter={onApplyFilter}
              onDeleteFilter={onDeleteFilter}
              paginationTestId="saved-filters-pagination"
            />
          </div>
        </div>
      )}
    </div>
  );
}
