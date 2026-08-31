"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Task } from "@/entities/task/schema";
import { TaskDetail } from "@/widgets/task/task-detail";
import { useTaskFilters } from "@/features/task/use-task-filters";
import { useSavedFilters } from "@/features/saved-filter/use-saved-filters";
import { usePagedItems } from "@/shared/lib/use-paged-items";
import { cn } from "@/shared/lib/utils";
import { PaginationBar } from "@/shared/ui/pagination";
import { ExportActions } from "./export-actions";
import { TaskFilters } from "./task-filters";
import { SavedFiltersPanel } from "./saved-filters-panel";
import { TaskRow } from "./task-row";

const KanbanBoard = dynamic(
  () => import("@/widgets/kanban/kanban-board").then((mod) => ({ default: mod.KanbanBoard })),
  {
    loading: () => (
      <p className="text-sm text-muted-foreground" role="status" data-testid="kanban-chunk-loading">
        Загрузка канбана…
      </p>
    ),
  },
);

interface TaskListProps {
  tasks: Task[];
  now?: Date;
  workDayHours?: number;
  canEdit?: boolean;
  otherUserChangesEnabled?: boolean;
  exportList?: { id: string; title: string };
}

export function TaskList({
  tasks: initialTasks,
  now = new Date(),
  workDayHours,
  canEdit = false,
  otherUserChangesEnabled = false,
  exportList,
}: TaskListProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { draft, setDraft, apply, clear, restore, filteredTasks, appliedSearch } = useTaskFilters(tasks);
  const savedFilters = useSavedFilters();
  const { page, setPage, totalPages, pageItems } = usePagedItems(filteredTasks);

  const codeById = useMemo(() => new Map(tasks.map((task) => [task.id, task.code])), [tasks]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  const handleOpen = useCallback((clickedTask: Task) => {
    setSelectedTaskId(clickedTask.id);
  }, []);

  const handleTaskUpdated = useCallback((updatedTask: Task) => {
    setTasks((current) =>
      current.map((task) => (task.id === updatedTask.id ? { ...task, ...updatedTask } : task)),
    );
  }, []);

  function handleApply() {
    apply();
    setPage(1);
    void savedFilters.applyFilter(draft);
  }

  function handleClear() {
    clear();
    setPage(1);
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
        <TaskFilters tasks={tasks} draft={draft} onDraftChange={setDraft} onApply={handleApply} onClear={handleClear} />

        <SavedFiltersPanel
          recent={savedFilters.recent}
          saved={savedFilters.saved}
          isLoading={savedFilters.isLoading}
          error={savedFilters.error}
          onApplyFilter={(id, criteria) => {
            restore(criteria);
            setPage(1);
            void savedFilters.touchFilter(id);
          }}
          onSaveFilter={(label) => void savedFilters.saveFilter(draft, label)}
          onDeleteFilter={(id) => void savedFilters.deleteFilter(id)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1" aria-label="Вид задач">
          <button
            type="button"
            aria-pressed={view === "list"}
            data-testid="task-view-list"
            className={cn(
              "inline-flex h-7 items-center rounded-md px-2.5 text-sm font-medium transition-colors",
              view === "list" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setView("list")}
          >
            Список
          </button>
          <button
            type="button"
            aria-pressed={view === "kanban"}
            data-testid="task-view-kanban"
            className={cn(
              "inline-flex h-7 items-center rounded-md px-2.5 text-sm font-medium transition-colors",
              view === "kanban" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setView("kanban")}
          >
            Канбан
          </button>
        </div>

        {exportList && (
          <ExportActions
            listId={exportList.id}
            listTitle={exportList.title}
            tasks={filteredTasks}
            lookupTasks={tasks}
          />
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="task-list-empty-state">
          В этом списке пока нет активных задач.
        </p>
      ) : filteredTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="task-list-no-results">
          Ничего не найдено. Измените условия поиска или фильтры.
        </p>
      ) : view === "kanban" ? (
        <KanbanBoard
          tasks={filteredTasks}
          lookupTasks={tasks}
          now={now}
          canEdit={canEdit}
          searchQuery={appliedSearch}
          onOpen={handleOpen}
          onTaskUpdated={handleTaskUpdated}
        />
      ) : (
        <>
          <ul
            className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
            data-testid="task-list"
          >
            {pageItems.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                dependencyCodes={task.dependsOn.flatMap((id) => {
                  const code = codeById.get(id);
                  return code ? [code] : [];
                })}
                now={now}
                searchQuery={appliedSearch}
                onOpen={handleOpen}
              />
            ))}
          </ul>
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} data-testid="task-list-pagination" />
        </>
      )}

      {selectedTask && (
        <TaskDetail
          key={selectedTask.id}
          task={selectedTask}
          dependencyCodes={selectedTask.dependsOn.flatMap((id) => {
            const code = codeById.get(id);
            return code ? [code] : [];
          })}
          open={selectedTaskId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTaskId(null);
            }
          }}
          canEdit={canEdit}
          listTasks={tasks}
          now={now}
          workDayHours={workDayHours}
          otherUserChangesEnabled={otherUserChangesEnabled}
          onTaskUpdated={handleTaskUpdated}
          onTaskCloned={(clonedTask) => {
            setTasks((current) => [...current, clonedTask]);
          }}
        />
      )}
    </div>
  );
}
