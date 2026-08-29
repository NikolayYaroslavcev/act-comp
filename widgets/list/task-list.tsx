"use client";

import { useState } from "react";
import type { Task } from "@/entities/task/schema";
import { TaskDetail } from "@/widgets/task/task-detail";
import { KanbanBoard } from "@/widgets/kanban/kanban-board";
import { useTaskFilters } from "@/features/task/use-task-filters";
import { useSavedFilters } from "@/features/saved-filter/use-saved-filters";
import { cn } from "@/shared/lib/utils";
import { ExportActions } from "./export-actions";
import { TaskFilters } from "./task-filters";
import { SavedFiltersPanel } from "./saved-filters-panel";
import { TaskRow } from "./task-row";

interface TaskListProps {
  tasks: Task[];
  now?: Date;
  canEdit?: boolean;
  exportList?: { id: string; title: string };
}

export function TaskList({
  tasks: initialTasks,
  now = new Date(),
  canEdit = false,
  exportList,
}: TaskListProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { draft, setDraft, apply, clear, restore, filteredTasks, appliedSearch } = useTaskFilters(tasks);
  const savedFilters = useSavedFilters();

  const codeById = new Map(tasks.map((task) => [task.id, task.code]));
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  function handleApply() {
    apply();
    void savedFilters.applyFilter(draft);
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {exportList && (
        <div className="flex justify-end">
          <ExportActions
            listId={exportList.id}
            listTitle={exportList.title}
            tasks={filteredTasks}
            lookupTasks={tasks}
          />
        </div>
      )}

      <TaskFilters tasks={tasks} draft={draft} onDraftChange={setDraft} onApply={handleApply} onClear={clear} />

      <div className="flex flex-wrap gap-2" aria-label="Вид задач">
        <button
          type="button"
          aria-pressed={view === "list"}
          data-testid="task-view-list"
          className={cn(
            "inline-flex h-8 items-center rounded-lg border px-2.5 text-sm font-medium",
            view === "list"
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-border bg-background hover:bg-muted",
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
            "inline-flex h-8 items-center rounded-lg border px-2.5 text-sm font-medium",
            view === "kanban"
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-border bg-background hover:bg-muted",
          )}
          onClick={() => setView("kanban")}
        >
          Канбан
        </button>
      </div>

      <SavedFiltersPanel
        recent={savedFilters.recent}
        saved={savedFilters.saved}
        isLoading={savedFilters.isLoading}
        error={savedFilters.error}
        onApplyFilter={(id, criteria) => {
          restore(criteria);
          void savedFilters.touchFilter(id);
        }}
        onSaveFilter={(label) => void savedFilters.saveFilter(draft, label)}
        onDeleteFilter={(id) => void savedFilters.deleteFilter(id)}
      />

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
          onOpen={(clickedTask) => setSelectedTaskId(clickedTask.id)}
          onTaskUpdated={(updatedTask) => {
            setTasks((current) =>
              current.map((task) => (task.id === updatedTask.id ? { ...task, ...updatedTask } : task)),
            );
          }}
        />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="task-list">
          {filteredTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              dependencyCodes={task.dependsOn.flatMap((id) => {
                const code = codeById.get(id);
                return code ? [code] : [];
              })}
              now={now}
              searchQuery={appliedSearch}
              onOpen={(clickedTask) => setSelectedTaskId(clickedTask.id)}
            />
          ))}
        </ul>
      )}

      {selectedTask && (
        <TaskDetail
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
          onTaskUpdated={(updatedTask) => {
            setTasks((current) => current.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
          }}
          onTaskCloned={(clonedTask) => {
            setTasks((current) => [...current, clonedTask]);
          }}
        />
      )}
    </div>
  );
}
