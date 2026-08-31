"use client";

import type { ListTemplate } from "@/entities/list/schema";
import type { ListFilterCriteria } from "@/entities/saved-filter/list-query-schema";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

interface ListFiltersProps {
  draft: ListFilterCriteria;
  onDraftChange: (criteria: ListFilterCriteria) => void;
  onApply: () => void;
  onClear: () => void;
}

const TEMPLATE_OPTIONS: { value: ListTemplate; label: string }[] = [
  { value: "work", label: "Работа" },
  { value: "personal", label: "Личное" },
  { value: "project", label: "Проект" },
];

export function ListFilters({ draft, onDraftChange, onApply, onClear }: ListFiltersProps) {
  function toggleTemplate(template: ListTemplate, checked: boolean) {
    onDraftChange({
      ...draft,
      template: checked ? [...draft.template, template] : draft.template.filter((value) => value !== template),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        id="list-filters-search"
        data-testid="list-filters-search"
        aria-label="Поиск списков"
        placeholder="Поиск по названию списка…"
        value={draft.search}
        onChange={(event) => onDraftChange({ ...draft, search: event.target.value })}
        className="bg-background"
      />

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Шаблон</span>
        <div className="flex flex-wrap gap-3 pt-1">
          {TEMPLATE_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <Checkbox
                id={`list-filters-template-${option.value}`}
                data-testid={`list-filters-template-${option.value}`}
                checked={draft.template.includes(option.value)}
                onCheckedChange={(checked) => toggleTemplate(option.value, checked === true)}
              />
              <Label htmlFor={`list-filters-template-${option.value}`} className="font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" data-testid="list-filters-apply" onClick={onApply}>
          Применить
        </Button>
        <Button type="button" size="sm" data-testid="list-filters-clear" variant="outline" onClick={onClear}>
          Очистить
        </Button>
      </div>
    </div>
  );
}
