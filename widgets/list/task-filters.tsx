"use client";

import type { Task, TaskStatus } from "@/entities/task/schema";
import type { TaskFilterCriteria } from "@/entities/saved-filter/query-schema";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/shared/lib/datetime-local";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DatePicker } from "@/shared/ui/date-picker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

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

export { fromDatetimeLocalValue, toDatetimeLocalValue };

function clampPriority(value: string): number | null {
  if (value === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return Math.min(5, Math.max(1, Math.round(parsed)));
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
    <div className="flex flex-col gap-3">
      <Input
        id="task-filters-search"
        data-testid="task-filters-search"
        aria-label="Поиск"
        placeholder="Поиск: код, название, описание, категория, теги…"
        value={draft.search}
        onChange={(event) => onDraftChange({ ...draft, search: event.target.value })}
        className="bg-background"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Статус</span>
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
          <Label htmlFor="task-filters-category" className="text-xs font-medium text-muted-foreground">
            Категория
          </Label>
          <Select
            items={[{ value: "__all__", label: "Все категории" }, ...categories.map((category) => ({ value: category, label: category }))]}
            value={draft.category ?? "__all__"}
            onValueChange={(value) =>
              onDraftChange({ ...draft, category: !value || value === "__all__" ? null : value })
            }
          >
            <SelectTrigger id="task-filters-category" data-testid="task-filters-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" label="Все категории">Все категории</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category} label={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {tags.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-2">
              <span className="text-xs font-medium text-muted-foreground">Теги</span>
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
          <Label htmlFor="task-filters-priority-min" className="text-xs font-medium text-muted-foreground">
            Приоритет от
          </Label>
          <Input
            id="task-filters-priority-min"
            data-testid="task-filters-priority-min"
            type="number"
            min={1}
            max={5}
            value={draft.priorityMin ?? ""}
            onChange={(event) => onDraftChange({ ...draft, priorityMin: clampPriority(event.target.value) })}
          />
          <Label htmlFor="task-filters-priority-max" className="text-xs font-medium text-muted-foreground">
            Приоритет до
          </Label>
          <Input
            id="task-filters-priority-max"
            data-testid="task-filters-priority-max"
            type="number"
            min={1}
            max={5}
            value={draft.priorityMax ?? ""}
            onChange={(event) => onDraftChange({ ...draft, priorityMax: clampPriority(event.target.value) })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-filters-deadline-from" className="text-xs font-medium text-muted-foreground">
            Дедлайн от
          </Label>
          <DatePicker
            id="task-filters-deadline-from"
            data-testid="task-filters-deadline-from"
            includeTime
            value={draft.deadlineFrom ? new Date(draft.deadlineFrom) : null}
            onChange={(date) => onDraftChange({ ...draft, deadlineFrom: date ? date.toISOString() : null })}
          />
          <Label htmlFor="task-filters-deadline-to" className="text-xs font-medium text-muted-foreground">
            Дедлайн до
          </Label>
          <DatePicker
            id="task-filters-deadline-to"
            data-testid="task-filters-deadline-to"
            includeTime
            value={draft.deadlineTo ? new Date(draft.deadlineTo) : null}
            onChange={(date) => onDraftChange({ ...draft, deadlineTo: date ? date.toISOString() : null })}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" data-testid="task-filters-apply" onClick={onApply}>
          Применить
        </Button>
        <Button type="button" data-testid="task-filters-clear" variant="outline" onClick={onClear}>
          Очистить
        </Button>
      </div>
    </div>
  );
}
