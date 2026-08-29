"use client";

import { useState } from "react";
import type { Task } from "@/entities/task/schema";
import { TaskDetail } from "@/widgets/task/task-detail";
import { useTaskFilters } from "@/features/task/use-task-filters";
import { useSavedFilters } from "@/features/saved-filter/use-saved-filters";
import { TaskFilters } from "./task-filters";
import { SavedFiltersPanel } from "./saved-filters-panel";
import { TaskRow } from "./task-row";

interface TaskListProps {
  tasks: Task[];
  now?: Date;
  canEdit?: boolean;
}

export function TaskList({ tasks: initialTasks, now = new Date(), canEdit = false }: TaskListProps) {
  const [tasks, setTasks] = useState(initialTasks);
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
    <div className="flex flex-col gap-4">
      <TaskFilters tasks={tasks} draft={draft} onDraftChange={setDraft} onApply={handleApply} onClear={clear} />

      <SavedFiltersPanel
        recent={savedFilters.recent}
        saved={savedFilters.saved}
        isLoading={savedFilters.isLoading}
        error={savedFilters.error}
        onApplyFilter={restore}
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
