"use client";

import type { Task, TaskStatus } from "@/entities/task/schema";
import type { TaskFilterCriteria } from "@/entities/saved-filter/query-schema";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

interface TaskFiltersProps {
  tasks: Task[];
  draft: TaskFilterCriteria;
  onDraftChange: (criteria: TaskFilterCriteria) => void;
  onApply: () => void;
  onClear: () => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "new", label: "Новая" },
  { value: "in_progress", label: "В работе" },
  { value: "done", label: "Готово" },
];

function distinctCategories(tasks: Task[]): string[] {
  return [...new Set(tasks.map((task) => task.category).filter((category): category is string => category !== null))];
}

function distinctTags(tasks: Task[]): string[] {
  return [...new Set(tasks.flatMap((task) => task.tags))];
}

function toDatetimeLocalValue(iso: string | null): string {
  if (iso === null) return "";
  return iso.slice(0, 16);
}

function fromDatetimeLocalValue(value: string): string | null {
  if (value === "") return null;
  return new Date(value).toISOString();
}

export function TaskFilters({ tasks, draft, onDraftChange, onApply, onClear }: TaskFiltersProps) {
  const categories = distinctCategories(tasks);
  const tags = distinctTags(tasks);

  function toggleStatus(status: TaskStatus, checked: boolean) {
    onDraftChange({
      ...draft,
      status: checked ? [...draft.status, status] : draft.status.filter((value) => value !== status),
    });
  }

  function toggleTag(tag: string, checked: boolean) {
    onDraftChange({
      ...draft,
      tags: checked ? [...draft.tags, tag] : draft.tags.filter((value) => value !== tag),
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1.5">
        <Label htmlFor="task-filters-search">Поиск</Label>
        <Input
          id="task-filters-search"
          data-testid="task-filters-search"
          placeholder="Код, название, описание, категория, теги…"
          value={draft.search}
          onChange={(event) => onDraftChange({ ...draft, search: event.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <span className="text-sm leading-none font-medium">Статус</span>
          <div className="flex flex-col gap-1.5 pt-1">
            {STATUS_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={`task-filters-status-${option.value}`}
                  data-testid={`task-filters-status-${option.value}`}
                  checked={draft.status.includes(option.value)}
                  onCheckedChange={(checked) => toggleStatus(option.value, checked === true)}
                />
                <Label htmlFor={`task-filters-status-${option.value}`} className="font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-filters-category">Категория</Label>
          <Select
            id="task-filters-category"
            data-testid="task-filters-category"
            value={draft.category ?? ""}
            onChange={(event) => onDraftChange({ ...draft, category: event.target.value === "" ? null : event.target.value })}
          >
            <option value="">Все категории</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>

          {tags.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-2">
              <span className="text-sm leading-none font-medium">Теги</span>
              {tags.map((tag) => (
                <div key={tag} className="flex items-center gap-2">
                  <Checkbox
                    id={`task-filters-tag-${tag}`}
                    data-testid={`task-filters-tag-${tag}`}
                    checked={draft.tags.includes(tag)}
                    onCheckedChange={(checked) => toggleTag(tag, checked === true)}
                  />
                  <Label htmlFor={`task-filters-tag-${tag}`} className="font-normal">
                    #{tag}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-filters-priority-min">Приоритет от</Label>
          <Input
            id="task-filters-priority-min"
            data-testid="task-filters-priority-min"
            type="number"
            min={1}
            max={5}
            value={draft.priorityMin ?? ""}
            onChange={(event) =>
              onDraftChange({ ...draft, priorityMin: event.target.value === "" ? null : Number(event.target.value) })
            }
          />
          <Label htmlFor="task-filters-priority-max">Приоритет до</Label>
          <Input
            id="task-filters-priority-max"
            data-testid="task-filters-priority-max"
            type="number"
            min={1}
            max={5}
            value={draft.priorityMax ?? ""}
            onChange={(event) =>
              onDraftChange({ ...draft, priorityMax: event.target.value === "" ? null : Number(event.target.value) })
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-filters-deadline-from">Дедлайн от</Label>
          <Input
            id="task-filters-deadline-from"
            data-testid="task-filters-deadline-from"
            type="datetime-local"
            value={toDatetimeLocalValue(draft.deadlineFrom)}
            onChange={(event) => onDraftChange({ ...draft, deadlineFrom: fromDatetimeLocalValue(event.target.value) })}
          />
          <Label htmlFor="task-filters-deadline-to">Дедлайн до</Label>
          <Input
            id="task-filters-deadline-to"
            data-testid="task-filters-deadline-to"
            type="datetime-local"
            value={toDatetimeLocalValue(draft.deadlineTo)}
            onChange={(event) => onDraftChange({ ...draft, deadlineTo: fromDatetimeLocalValue(event.target.value) })}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button data-testid="task-filters-apply" onClick={onApply}>
          Применить
        </Button>
        <Button data-testid="task-filters-clear" variant="outline" onClick={onClear}>
          Очистить
        </Button>
      </div>
    </div>
  );
}
