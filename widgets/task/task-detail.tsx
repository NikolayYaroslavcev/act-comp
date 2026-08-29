import { useCallback, useState } from "react";
import type { Task } from "@/entities/task/schema";
import type { UpdateTaskInput } from "@/entities/task/requests";
import { calculateParentProgress, selectActiveSubtasks } from "@/entities/task/model";
import { useUpdateTask } from "@/features/task/use-update-task";
import { useCloneTask } from "@/features/task/use-clone-task";
import { Badge } from "@/shared/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Progress } from "@/shared/ui/progress";
import { cn } from "@/shared/lib/utils";
import { TaskEditForm } from "./task-edit-form";
import { TaskComments } from "./task-comments";
import { TaskTimer } from "./task-timer";

interface TaskDetailProps {
  task: Task;
  dependencyCodes: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  listTasks?: Task[];
  onTaskUpdated?: (task: Task) => void;
  onTaskCloned?: (task: Task) => void;
}

const STATUS_LABELS = {
  new: "Новая",
  in_progress: "В работе",
  done: "Готово",
} as const;

const STATUS_BADGE_VARIANT = {
  new: "outline",
  in_progress: "default",
  done: "muted",
} as const;

const dateFormatter = new Intl.DateTimeFormat("ru", { dateStyle: "medium" });

function DetailRow({ label, testId, children }: { label: string; testId: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words" data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

export function TaskDetail({
  task,
  dependencyCodes,
  open,
  onOpenChange,
  canEdit = false,
  listTasks = [],
  onTaskUpdated = () => {},
  onTaskCloned = () => {},
}: TaskDetailProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const { updateTask, isPending, error } = useUpdateTask();
  const { cloneTask, isPending: isCloning, error: cloneError } = useCloneTask();

  const parentTask =
    task.parentId !== null ? (listTasks.find((candidate) => candidate.id === task.parentId) ?? null) : null;
  const subtasks = selectActiveSubtasks(task, listTasks);
  const progress = calculateParentProgress(task, listTasks);

  const handleCancel = useCallback(() => {
    setMode("view");
  }, []);

  const handleSubmit = useCallback(
    async (patch: UpdateTaskInput | null) => {
      if (isPending) {
        return;
      }

      if (patch === null) {
        setMode("view");
        return;
      }

      const result = await updateTask(task.id, patch);
      if (result) {
        // cascade is informational (Smart Priority UI is out of scope for this task)
        onTaskUpdated(result.task);
        setMode("view");
      }
    },
    [isPending, onTaskUpdated, task.id, updateTask],
  );

  const handleClone = useCallback(async () => {
    if (isCloning) {
      return;
    }

    const cloned = await cloneTask(task.id);
    if (cloned) {
      onTaskCloned(cloned);
      onOpenChange(false);
    }
  }, [cloneTask, isCloning, onOpenChange, onTaskCloned, task.id]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => onOpenChange(nextOpen)}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            <span className="block font-mono text-xs font-normal text-muted-foreground">{task.code}</span>
            {task.title}
          </DialogTitle>
        </DialogHeader>

        {mode === "edit" ? (
          <>
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <TaskEditForm
              task={task}
              listTasks={listTasks}
              isPending={isPending}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </>
        ) : (
          <>
            {cloneError && (
              <p
                role="alert"
                data-testid="task-detail-clone-error"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {cloneError}
              </p>
            )}

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailRow label="Статус" testId="task-detail-status">
                <Badge variant={STATUS_BADGE_VARIANT[task.status]}>{STATUS_LABELS[task.status]}</Badge>
              </DetailRow>

              <DetailRow label="Приоритет" testId="task-detail-priority">
                {task.priority}
              </DetailRow>

              <DetailRow label="Категория" testId="task-detail-category">
                {task.category ?? "Без категории"}
              </DetailRow>

              <DetailRow label="Дедлайн" testId="task-detail-deadline">
                {task.deadline ? dateFormatter.format(new Date(task.deadline)) : "Без дедлайна"}
              </DetailRow>

              <DetailRow label="Оценка времени" testId="task-detail-estimated">
                {task.estimatedMin} мин
              </DetailRow>

              <DetailRow label="Затрачено времени" testId="task-detail-time-spent">
                {task.timeSpentMin} мин
              </DetailRow>

              <DetailRow label="Создано" testId="task-detail-created">
                {dateFormatter.format(new Date(task.createdAt))}
              </DetailRow>

              {parentTask !== null && (
                <DetailRow label="Родительская задача" testId="task-detail-parent">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{parentTask.code}</span>
                    <span className="min-w-0 truncate">{parentTask.title}</span>
                  </span>
                </DetailRow>
              )}
            </dl>

            <DetailRow label="Описание" testId="task-detail-description">
              {task.description || "Без описания"}
            </DetailRow>

            <DetailRow label="Теги" testId="task-detail-tags">
              {task.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                "Без тегов"
              )}
            </DetailRow>

            <DetailRow label="Зависит от" testId="task-detail-dependencies">
              {dependencyCodes.length > 0 ? dependencyCodes.join(", ") : "Нет зависимостей"}
            </DetailRow>

            {progress !== null && (
              <div className="flex flex-col gap-1.5" data-testid="task-detail-subtask-progress">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {progress.done} / {progress.total} выполнено
                  </span>
                  <span className="tabular-nums">{progress.percent}%</span>
                </div>
                <Progress value={progress.percent} aria-label="Прогресс подзадач" />
              </div>
            )}

            {subtasks.length > 0 && (
              <DetailRow label="Список подзадач" testId="task-detail-subtask-list">
                <ul className="flex flex-col gap-1.5">
                  {subtasks.map((subtask) => (
                    <li
                      key={subtask.id}
                      data-testid="task-detail-subtask-row"
                      className={cn(
                        "flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border px-3 py-2",
                        subtask.status === "done" && "opacity-60",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">{subtask.code}</span>
                        <span className={cn("min-w-0 truncate", subtask.status === "done" && "line-through")}>
                          {subtask.title}
                        </span>
                      </span>
                      <Badge variant={STATUS_BADGE_VARIANT[subtask.status]} className="shrink-0">
                        {STATUS_LABELS[subtask.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </DetailRow>
            )}

            <TaskComments taskId={task.id} canComment={canEdit} />

            <TaskTimer task={task} canEdit={canEdit} onTaskUpdated={onTaskUpdated} />

            <div className="flex justify-end gap-2">
              <DialogClose
                render={
                  <Button variant="outline" data-testid="task-detail-close">
                    Закрыть
                  </Button>
                }
              />
              {canEdit && (
                <Button
                  variant="outline"
                  data-testid="task-detail-clone"
                  disabled={isCloning}
                  onClick={handleClone}
                >
                  {isCloning ? "Клонирование..." : "Клонировать"}
                </Button>
              )}
              {canEdit && (
                <Button data-testid="task-detail-edit" onClick={() => setMode("edit")}>
                  Редактировать
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
