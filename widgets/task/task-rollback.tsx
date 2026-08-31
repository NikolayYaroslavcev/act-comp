"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";
import type { Task } from "@/entities/task/schema";
import {
  listRestorableTaskVersions,
  previewTaskRollback,
  type RestorableTaskVersion,
  type UpdatableTaskField,
} from "@/entities/task/model";
import { useRollbackTask } from "@/features/task/use-rollback-task";
import { usePagedItems } from "@/shared/lib/use-paged-items";
import { formatDateTime } from "@/shared/lib/format-date";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { PaginationBar } from "@/shared/ui/pagination";

interface TaskRollbackProps {
  task: Task;
  onTaskUpdated: (task: Task) => void;
}

const FIELD_LABELS: Record<UpdatableTaskField, string> = {
  title: "Название",
  description: "Описание",
  status: "Статус",
  priority: "Приоритет",
  category: "Категория",
  tags: "Теги",
  deadline: "Дедлайн",
  estimatedMin: "Оценка времени",
  dependsOn: "Зависимости",
  parentId: "Родительская задача",
};

const STATUS_LABELS = {
  new: "Новая",
  in_progress: "В работе",
  done: "Готово",
} as const;

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "пусто";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "пусто" : value.join(", ");
  }
  if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return formatDateTime(value);
  }
  if (value === "new" || value === "in_progress" || value === "done") {
    return STATUS_LABELS[value];
  }
  return String(value);
}

export function TaskRollback({ task, onTaskUpdated }: TaskRollbackProps) {
  const versions = useMemo(() => [...listRestorableTaskVersions(task)].reverse(), [task]);
  const { page, setPage, totalPages, pageItems } = usePagedItems(versions);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { rollbackTask, isPending, error } = useRollbackTask();

  const selectedVersion: RestorableTaskVersion | undefined =
    selectedIndex === null ? undefined : versions.find((version) => version.historyIndex === selectedIndex);
  const preview =
    selectedIndex === null ? { status: "unknown_version" as const } : previewTaskRollback(task, selectedIndex);

  const handleToggleHistory = useCallback(() => {
    setOpen((current) => {
      if (!current && versions[0]) {
        setSelectedIndex(versions[0].historyIndex);
      }
      return !current;
    });
  }, [versions]);

  const handleConfirm = useCallback(async () => {
    if (isPending || selectedIndex === null) {
      return;
    }

    const result = await rollbackTask(task.id, selectedIndex);
    if (result) {
      setConfirmOpen(false);
      onTaskUpdated(result.task);
    }
  }, [isPending, onTaskUpdated, rollbackTask, selectedIndex, task.id]);

  if (versions.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        data-testid="task-detail-history"
        aria-expanded={open}
        aria-controls="task-rollback-versions"
        onClick={handleToggleHistory}
      >
        История изменений
      </Button>

      {open && (
        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex min-w-0 flex-col gap-2">
            <div
              id="task-rollback-versions"
              role="listbox"
              aria-label="Предыдущие версии"
              className="flex min-w-0 flex-col gap-1"
            >
            {pageItems.map((version) => {
              const selected = version.historyIndex === selectedIndex;
              return (
                <button
                  key={version.historyIndex}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="flex min-w-0 flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-muted aria-selected:bg-muted"
                  onClick={() => setSelectedIndex(version.historyIndex)}
                >
                  <span className="break-words">{formatDateTime(version.at)}</span>
                  <span className="text-xs break-all text-muted-foreground">{version.byUserId}</span>
                </button>
              );
            })}
            </div>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              data-testid="task-rollback-pagination"
            />
          </div>

          {preview.status === "ok" && selectedVersion && (
            <div
              data-testid="task-rollback-preview"
              aria-live="polite"
              className="flex min-w-0 flex-col gap-2 text-sm"
            >
              <p className="text-xs text-muted-foreground">
                {formatDateTime(preview.at)} · {preview.byUserId}
              </p>
              {preview.changes.map((change) => (
                <div key={change.field} className="min-w-0 break-words">
                  <span className="font-medium">{FIELD_LABELS[change.field]}: </span>
                  <span>{formatPreviewValue(change.current)}</span>
                  <span> → </span>
                  <span>{formatPreviewValue(change.restored)}</span>
                </div>
              ))}
              {preview.changes.length === 0 && <p>Эта версия совпадает с текущим состоянием.</p>}
              <Button type="button" onClick={() => setConfirmOpen(true)}>
                Откатить к этой версии
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={(nextOpen) => {
          if (!isPending) {
            setConfirmOpen(nextOpen);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Откатить задачу?</DialogTitle>
            <DialogDescription>
              Текущие значения выбранных полей будут заменены на состояние до этого изменения. История сохранится.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={isPending} aria-busy={isPending} onClick={handleConfirm}>
              {isPending ? (
                <>
                  <Loader2Icon className="animate-spin" aria-hidden="true" />
                  Откат...
                </>
              ) : (
                "Откатить"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
