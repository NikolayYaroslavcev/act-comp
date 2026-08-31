"use client";

import { useState } from "react";
import { HistoryIcon } from "lucide-react";
import type { ListHistoryItem } from "@/features/list/list-history";
import { formatDateTime } from "@/shared/lib/format-date";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

interface ListHistoryDialogProps {
  history: ListHistoryItem[];
}

const FIELD_LABELS: Record<string, string> = {
  title: "Название",
  template: "Шаблон",
  deadline: "Дедлайн",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "пусто";
  }
  return String(value);
}

function describeEntry(entry: ListHistoryItem): { label: string; diff: string | null } {
  if (entry.field === "deletedAt") {
    return entry.new !== null
      ? { label: `${entry.actorEmail} удалил список`, diff: null }
      : { label: `${entry.actorEmail} восстановил список`, diff: null };
  }

  const fieldLabel = FIELD_LABELS[entry.field] ?? entry.field;
  return {
    label: `${entry.actorEmail} изменил «${fieldLabel}»`,
    diff: `${formatValue(entry.old)} → ${formatValue(entry.new)}`,
  };
}

/**
 * Renders TaskList.history (features/list/list-history.ts ->
 * getListHistoryForUser), the same field diff log updateList/deleteList/
 * restoreList already persist — no separate history store.
 */
export function ListHistoryDialog({ history }: ListHistoryDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HistoryIcon aria-hidden="true" />
        История
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>История изменений списка</DialogTitle>
          </DialogHeader>

          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="list-history-empty">
              Пока нет изменений
            </p>
          ) : (
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {history.map((entry, index) => {
                const { label, diff } = describeEntry(entry);
                return (
                  <li
                    key={`${entry.field}-${entry.at}-${index}`}
                    data-testid="list-history-entry"
                    className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{label}</span>
                    {diff && <span className="text-muted-foreground">{diff}</span>}
                    <span className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
