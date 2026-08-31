"use client";

import { useCallback, useMemo } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Task } from "@/entities/task/schema";
import {
  applyKanbanStatusOverrides,
  groupTasksByKanbanColumn,
  isTaskBlocked,
  KANBAN_STATUSES,
} from "@/entities/task/model";
import { resolveKanbanDropStatus } from "@/features/task/kanban-drop";
import { useKanbanBoard } from "@/features/task/use-kanban-board";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";

const COLUMN_TITLES = {
  new: "Новые",
  in_progress: "В работе",
  done: "Готово",
} as const;

interface KanbanBoardProps {
  tasks: Task[];
  lookupTasks: Task[];
  now?: Date;
  canEdit?: boolean;
  searchQuery?: string;
  onOpen?: (task: Task) => void;
  onTaskUpdated?: (task: Task) => void;
}

export function KanbanBoard({
  tasks,
  lookupTasks,
  now = new Date(),
  canEdit = false,
  searchQuery,
  onOpen,
  onTaskUpdated,
}: KanbanBoardProps) {
  const { statusOverrides, pendingTaskIds, errorsByTaskId, moveTask } = useKanbanBoard({ onTaskUpdated });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const displayedTasks = useMemo(
    () => applyKanbanStatusOverrides(tasks, statusOverrides),
    [statusOverrides, tasks],
  );
  const lookupWithOverrides = useMemo(
    () => applyKanbanStatusOverrides(lookupTasks, statusOverrides),
    [lookupTasks, statusOverrides],
  );
  const columns = useMemo(() => groupTasksByKanbanColumn(displayedTasks), [displayedTasks]);
  const lookupById = useMemo(
    () => new Map(lookupWithOverrides.map((task) => [task.id, task])),
    [lookupWithOverrides],
  );
  const statusById = useMemo(() => {
    const next = new Map<string, Task["status"]>();
    for (const task of lookupWithOverrides) {
      next.set(task.id, task.status);
    }
    for (const task of displayedTasks) {
      next.set(task.id, task.status);
    }
    return next;
  }, [displayedTasks, lookupWithOverrides]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const overId = event.over ? String(event.over.id) : null;
      const nextStatus = resolveKanbanDropStatus(String(event.active.id), overId, statusById);
      if (nextStatus) {
        moveTask(String(event.active.id), nextStatus);
      }
    },
    [moveTask, statusById],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            return `Начато перемещение задачи ${String(active.id)}`;
          },
          onDragOver({ over }) {
            return over ? `Над колонкой ${COLUMN_TITLES[over.id as keyof typeof COLUMN_TITLES] ?? String(over.id)}` : "";
          },
          onDragEnd({ over }) {
            return over ? `Задача перемещена` : "Перемещение отменено";
          },
          onDragCancel() {
            return "Перемещение отменено";
          },
        },
      }}
    >
      {pendingTaskIds.size > 0 && (
        <p
          data-testid="kanban-board-loading"
          aria-live="polite"
          className="mb-2 text-xs text-muted-foreground"
        >
          Сохранение изменений…
        </p>
      )}
      {Object.keys(errorsByTaskId).length > 0 && (
        <p
          data-testid="kanban-board-error"
          aria-live="polite"
          className="mb-2 text-xs text-destructive"
        >
          Не удалось обновить {Object.keys(errorsByTaskId).length}{" "}
          {Object.keys(errorsByTaskId).length === 1 ? "задачу" : "задачи"}. Подробности — на карточке.
        </p>
      )}
      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-muted/20 p-3">
        <div
          data-testid="kanban-board"
          className="flex min-w-0 w-full max-w-full gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-x-visible"
        >
          {KANBAN_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              title={COLUMN_TITLES[status]}
              count={columns[status].length}
              isEmpty={columns[status].length === 0}
            >
              {columns[status].map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  blocked={isTaskBlocked(task, lookupById)}
                  now={now}
                  searchQuery={searchQuery}
                  canEdit={canEdit}
                  isPending={pendingTaskIds.has(task.id)}
                  error={errorsByTaskId[task.id]}
                  onOpen={(opened) => onOpen?.(opened)}
                  onStatusChange={(nextStatus) => moveTask(task.id, nextStatus)}
                />
              ))}
            </KanbanColumn>
          ))}
        </div>
      </div>
    </DndContext>
  );
}
