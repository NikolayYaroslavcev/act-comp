"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task, TaskStatus } from "@/entities/task/schema";
import { isTaskOverdue } from "@/entities/task/model";
import { Badge } from "@/shared/ui/badge";
import { HighlightedText } from "@/shared/ui/highlighted-text";
import { Select } from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";
import { GripVertical } from "lucide-react";

const STATUS_LABELS: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Готово",
};

const STATUS_BADGE_VARIANT: Record<TaskStatus, "outline" | "default" | "muted"> = {
  new: "outline",
  in_progress: "default",
  done: "muted",
};

const deadlineFormatter = new Intl.DateTimeFormat("ru", { dateStyle: "medium" });

interface KanbanCardProps {
  task: Task;
  blocked: boolean;
  now: Date;
  searchQuery?: string;
  canEdit: boolean;
  isPending: boolean;
  error?: string;
  onOpen: (task: Task) => void;
  onStatusChange: (status: TaskStatus) => void;
}

export function KanbanCard({
  task,
  blocked,
  now,
  searchQuery,
  canEdit,
  isPending,
  error,
  onOpen,
  onStatusChange,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canEdit || task.deletedAt !== null,
  });
  const overdue = isTaskOverdue(task, now);
  const completed = task.status === "done";
  const selectId = `kanban-status-${task.id}`;

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      data-testid="kanban-card"
      data-completed={completed ? "true" : undefined}
      data-dragging={isDragging ? "true" : undefined}
      className={cn(
        "flex max-w-full flex-col gap-2 rounded-lg border border-border bg-card p-3",
        completed && "opacity-60",
        isDragging && "shadow-md",
      )}
    >
      <div className="flex items-start gap-1">
        {canEdit && (
          <button
            type="button"
            data-testid="kanban-drag-handle"
            className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Переместить задачу ${task.code}`}
            {...listeners}
            {...attributes}
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          data-testid="kanban-card-open"
          onClick={() => onOpen(task)}
          className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              <HighlightedText text={task.code} query={searchQuery} />
            </span>
            <span className={cn("text-sm font-medium break-words", completed && "line-through")}>
              <HighlightedText text={task.title} query={searchQuery} />
            </span>
            {overdue && (
              <Badge variant="outline" data-testid="task-overdue-badge" className="border-destructive/40 text-destructive">
                Просрочено
              </Badge>
            )}
            {blocked && (
              <Badge variant="outline" data-testid="kanban-card-blocked">
                Заблокирована
              </Badge>
            )}
          </div>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant={STATUS_BADGE_VARIANT[task.status]} data-testid="task-status">
          {STATUS_LABELS[task.status]}
        </Badge>
        <span className="text-muted-foreground" data-testid="task-priority">
          Приоритет: {task.priority}
        </span>
        <span
          className={cn("tabular-nums text-muted-foreground", overdue && "font-medium text-destructive")}
          data-testid="task-deadline"
        >
          {task.deadline ? deadlineFormatter.format(new Date(task.deadline)) : "Без дедлайна"}
        </span>
      </div>

      {canEdit && (
        <div className="flex flex-col gap-1" onPointerDown={(event) => event.stopPropagation()}>
          <label htmlFor={selectId} className="sr-only">
            Статус {task.code}
          </label>
          <Select
            id={selectId}
            data-testid="kanban-status-select"
            value={task.status}
            disabled={isPending}
            aria-label={`Статус ${task.code}`}
            onChange={(event) => {
              const next = event.target.value as TaskStatus;
              if (next !== task.status) {
                onStatusChange(next);
              }
            }}
          >
            <option value="new">{STATUS_LABELS.new}</option>
            <option value="in_progress">{STATUS_LABELS.in_progress}</option>
            <option value="done">{STATUS_LABELS.done}</option>
          </Select>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </article>
  );
}
