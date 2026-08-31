"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Task } from "@/entities/task/schema";
import type { UpdateTaskInput } from "@/entities/task/requests";
import { calculatePriority, calculateParentProgress, createSimilarTaskHistoryProvider, selectActiveSubtasks } from "@/entities/task/model";
import { predictTaskCompletion } from "@/entities/task/completion-prediction";
import { DEFAULT_SETTINGS } from "@/entities/user/schema";
import { useAppDispatch } from "@/shared/store/hooks";
import { activityApi } from "@/features/activity/activity-api";
import { useUpdateTask } from "@/features/task/use-update-task";
import { useCloneTask } from "@/features/task/use-clone-task";
import { useInlineTaskEdit, type InlineSaveStatus as InlineFieldSaveStatus, type InlineTaskFieldKey } from "@/features/task/use-inline-task-edit";
import { useTaskChangeWatch } from "@/features/task/use-task-change-watch";
import { requestGetTask } from "@/features/task/get-task-request";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/shared/lib/datetime-local";
import { Badge } from "@/shared/ui/badge";
import { DatePicker } from "@/shared/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Progress } from "@/shared/ui/progress";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { formatDurationMinutes } from "@/shared/lib/format-duration";
import { formatDate, formatDateTime } from "@/shared/lib/format-date";
import { usePagedItems } from "@/shared/lib/use-paged-items";
import { PaginationBar } from "@/shared/ui/pagination";
import { TaskEditForm } from "./task-edit-form";
import { TaskComments } from "./task-comments";
import { TaskActivity } from "./task-activity";
import { TaskAttachments } from "./task-attachments";
import { TaskAgeCounter } from "./task-age-counter";
import { TaskTimer } from "./task-timer";
import { InlineSaveStatus, inlineFieldKeyDown } from "./task-inline-fields";

const TaskRollback = dynamic(
  () => import("./task-rollback").then((mod) => ({ default: mod.TaskRollback })),
  {
    loading: () => (
      <p className="text-sm text-muted-foreground" role="status">
        Загрузка истории изменений…
      </p>
    ),
  },
);

const TaskExportActions = dynamic(
  () => import("./task-export-actions").then((mod) => ({ default: mod.TaskExportActions })),
  {
    loading: () => (
      <p className="text-sm text-muted-foreground" role="status">
        Загрузка экспорта…
      </p>
    ),
  },
);

interface TaskDetailProps {
  task: Task;
  dependencyCodes: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  listTasks?: Task[];
  now?: Date;
  workDayHours?: number;
  otherUserChangesEnabled?: boolean;
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

const PREDICTION_BASIS_LABELS = {
  estimate: "по оценке",
  history: "по истории похожих задач",
} as const;

function completionPredictionLabel(prediction: ReturnType<typeof predictTaskCompletion>): string {
  if (prediction.status === "done") {
    return "Задача завершена";
  }
  if (prediction.status === "deleted") {
    return "Недоступно для удалённой задачи";
  }
  if (prediction.status === "no_data") {
    return "Недостаточно данных для прогноза";
  }

  const { remainingMin, predictedCompletionAt, basis, isPastDeadline } = prediction;
  const overdueNote = isPastDeadline ? " · после дедлайна" : "";
  return `${remainingMin} мин осталось · ${formatDateTime(predictedCompletionAt!)} (${PREDICTION_BASIS_LABELS[basis!]})${overdueNote}`;
}

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

function isFieldInvalid(status: InlineFieldSaveStatus): boolean {
  return status === "invalid" || status === "error";
}

function InlineControl({
  field,
  label,
  testId,
  status,
  message,
  children,
}: {
  field: InlineTaskFieldKey;
  label: string;
  testId: string;
  status: InlineFieldSaveStatus;
  message: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt>
        <Label htmlFor={field === "status" ? undefined : `task-inline-${field}`} id={field === "status" ? "task-inline-status-label" : undefined} className="text-xs font-normal text-muted-foreground">
          {label}
        </Label>
      </dt>
      <dd className="min-w-0 text-sm" data-testid={testId}>
        {children}
        <InlineSaveStatus field={field} status={status} message={message} />
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
  now = new Date(),
  workDayHours = DEFAULT_SETTINGS.workDayHours,
  otherUserChangesEnabled = false,
  onTaskUpdated = () => {},
  onTaskCloned = () => {},
}: TaskDetailProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const { updateTask, isPending, error } = useUpdateTask();
  const { cloneTask, isPending: isCloning, error: cloneError } = useCloneTask();
  const dispatch = useAppDispatch();

  // Every task mutation that can add an Activity Log entry (field edits,
  // timer actions, rollback) flows through this single callback — hooking
  // the Activity cache invalidation here, rather than in each subsystem,
  // keeps Timer/Inline-edit/Rollback untouched while still keeping the log
  // fresh without a reopen (attachments invalidate the same tag directly
  // from useTaskAttachments, since they don't go through onTaskUpdated).
  const handleTaskUpdated = useCallback(
    (updatedTask: Task) => {
      onTaskUpdated(updatedTask);
      dispatch(activityApi.util.invalidateTags([{ type: "Activity", id: updatedTask.id }]));
    },
    [dispatch, onTaskUpdated],
  );

  const inline = useInlineTaskEdit({
    task,
    enabled: canEdit && mode === "view",
    onTaskUpdated: handleTaskUpdated,
  });
  const inlineEnabled = canEdit && mode === "view";

  const changeWatch = useTaskChangeWatch({ taskId: task.id, enabled: otherUserChangesEnabled && open });

  const handleRefreshExternalChange = useCallback(async () => {
    const fresh = await requestGetTask(task.id);
    if (fresh.status !== "ok") {
      return;
    }
    const merged = inline.applyExternalTask(fresh.task);
    handleTaskUpdated(merged);
    changeWatch.acknowledge();
  }, [changeWatch, handleTaskUpdated, inline, task.id]);

  const parentTask =
    task.parentId !== null ? (listTasks.find((candidate) => candidate.id === task.parentId) ?? null) : null;
  const subtasks = useMemo(() => selectActiveSubtasks(task, listTasks), [task, listTasks]);
  const { page: subtaskPage, setPage: setSubtaskPage, totalPages: subtaskPages, pageItems: pagedSubtasks } =
    usePagedItems(subtasks);
  const progress = useMemo(() => calculateParentProgress(task, listTasks), [task, listTasks]);
  const historyProvider = useMemo(() => createSimilarTaskHistoryProvider(listTasks), [listTasks]);
  const smartPriority = useMemo(
    () => calculatePriority(task, listTasks, historyProvider, now),
    [historyProvider, listTasks, now, task],
  );
  const prediction = useMemo(
    () => predictTaskCompletion(task, historyProvider, now, workDayHours),
    [historyProvider, now, task, workDayHours],
  );

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
        // cascade is informational only — recalculatedPriority there never
        // overwrites Task.priority, it just drives dependents' own Smart
        // Priority display next time they're opened.
        handleTaskUpdated(result.task);
        setMode("view");
      }
    },
    [handleTaskUpdated, isPending, task.id, updateTask],
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span className="block font-mono text-xs font-normal text-muted-foreground">{task.code}</span>
            <span className="text-xl break-words">{inlineEnabled ? inline.values.title : task.title}</span>
          </DialogTitle>
        </DialogHeader>

        {changeWatch.changed && (
          <div
            role="status"
            aria-live="polite"
            data-testid="task-detail-external-change"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm"
          >
            <span>{changeWatch.summary ?? "Задача изменена другим пользователем"}</span>
            {mode === "view" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="task-detail-external-change-refresh"
                onClick={() => void handleRefreshExternalChange()}
              >
                Обновить
              </Button>
            )}
          </div>
        )}

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
            {inlineEnabled && (
              <div className="flex min-w-0 flex-col gap-1">
                <Label htmlFor="task-inline-title" className="text-xs font-normal text-muted-foreground">
                  Название
                </Label>
                <Input
                  id="task-inline-title"
                  value={inline.values.title}
                  aria-busy={inline.statusOf("title") === "saving" || undefined}
                  aria-invalid={isFieldInvalid(inline.statusOf("title")) || undefined}
                  aria-describedby="task-inline-title-status"
                  className="min-w-0 break-words"
                  onChange={(event) => inline.setField("title", event.target.value)}
                  onKeyDown={inlineFieldKeyDown("title", false, inline.revertField, inline.flushField)}
                />
                <InlineSaveStatus field="title" status={inline.statusOf("title")} message={inline.messageOf("title")} />
              </div>
            )}

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {inlineEnabled ? (
                <InlineControl
                  field="status"
                  label="Статус"
                  testId="task-detail-status"
                  status={inline.statusOf("status")}
                  message={inline.messageOf("status")}
                >
                  <div
                    id="task-inline-status"
                    role="radiogroup"
                    aria-labelledby="task-inline-status-label"
                    aria-busy={inline.statusOf("status") === "saving" || undefined}
                    aria-invalid={isFieldInvalid(inline.statusOf("status")) || undefined}
                    aria-describedby="task-inline-status-status"
                    className="flex min-w-0 flex-wrap gap-1.5"
                    onKeyDown={inlineFieldKeyDown("status", false, inline.revertField, inline.flushField)}
                  >
                    {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((status) => (
                      <label
                        key={status}
                        className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-input px-2.5 py-1 text-sm"
                      >
                        <input
                          type="radio"
                          name="task-inline-status"
                          value={status}
                          checked={inline.values.status === status}
                          onChange={() => inline.setField("status", status)}
                        />
                        {STATUS_LABELS[status]}
                      </label>
                    ))}
                  </div>
                </InlineControl>
              ) : (
                <DetailRow label="Статус" testId="task-detail-status">
                  <Badge variant={STATUS_BADGE_VARIANT[task.status]}>{STATUS_LABELS[task.status]}</Badge>
                </DetailRow>
              )}

              {inlineEnabled ? (
                <InlineControl
                  field="priority"
                  label="Приоритет"
                  testId="task-detail-priority"
                  status={inline.statusOf("priority")}
                  message={inline.messageOf("priority")}
                >
                  <Input
                    id="task-inline-priority"
                    type="number"
                    min={1}
                    max={5}
                    step={1}
                    value={inline.values.priority}
                    aria-busy={inline.statusOf("priority") === "saving" || undefined}
                    aria-invalid={isFieldInvalid(inline.statusOf("priority")) || undefined}
                    aria-describedby="task-inline-priority-status"
                    onChange={(event) => inline.setField("priority", event.target.value)}
                    onKeyDown={inlineFieldKeyDown("priority", false, inline.revertField, inline.flushField)}
                  />
                </InlineControl>
              ) : (
                <DetailRow label="Приоритет" testId="task-detail-priority">
                  {task.priority}
                </DetailRow>
              )}

              <DetailRow label="Smart Priority" testId="task-detail-smart-priority">
                <span className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-mono">
                    {smartPriority}
                  </Badge>
                  <span className="text-xs text-muted-foreground">рассчитано автоматически</span>
                </span>
              </DetailRow>

              {inlineEnabled ? (
                <InlineControl
                  field="category"
                  label="Категория"
                  testId="task-detail-category"
                  status={inline.statusOf("category")}
                  message={inline.messageOf("category")}
                >
                  <Input
                    id="task-inline-category"
                    value={inline.values.category}
                    aria-busy={inline.statusOf("category") === "saving" || undefined}
                    aria-invalid={isFieldInvalid(inline.statusOf("category")) || undefined}
                    aria-describedby="task-inline-category-status"
                    onChange={(event) => inline.setField("category", event.target.value)}
                    onKeyDown={inlineFieldKeyDown("category", false, inline.revertField, inline.flushField)}
                  />
                </InlineControl>
              ) : (
                <DetailRow label="Категория" testId="task-detail-category">
                  {task.category ?? "Без категории"}
                </DetailRow>
              )}

              {inlineEnabled ? (
                <InlineControl
                  field="deadline"
                  label="Дедлайн"
                  testId="task-detail-deadline"
                  status={inline.statusOf("deadline")}
                  message={inline.messageOf("deadline")}
                >
                  <DatePicker
                    id="task-inline-deadline"
                    includeTime
                    data-testid="task-inline-deadline"
                    value={inline.values.deadline ? new Date(fromDatetimeLocalValue(inline.values.deadline) ?? inline.values.deadline) : null}
                    aria-busy={inline.statusOf("deadline") === "saving" || undefined}
                    aria-invalid={isFieldInvalid(inline.statusOf("deadline")) || undefined}
                    aria-describedby="task-inline-deadline-status"
                    onChange={(date) =>
                      inline.setField("deadline", date ? toDatetimeLocalValue(date.toISOString()) : "")
                    }
                  />
                </InlineControl>
              ) : (
                <DetailRow label="Дедлайн" testId="task-detail-deadline">
                  {task.deadline ? formatDate(task.deadline) : "Без дедлайна"}
                </DetailRow>
              )}

              {inlineEnabled ? (
                <InlineControl
                  field="estimatedMin"
                  label="Оценка времени"
                  testId="task-detail-estimated"
                  status={inline.statusOf("estimatedMin")}
                  message={inline.messageOf("estimatedMin")}
                >
                  <Input
                    id="task-inline-estimatedMin"
                    type="number"
                    min={0}
                    step={1}
                    value={inline.values.estimatedMin}
                    aria-busy={inline.statusOf("estimatedMin") === "saving" || undefined}
                    aria-invalid={isFieldInvalid(inline.statusOf("estimatedMin")) || undefined}
                    aria-describedby="task-inline-estimatedMin-status"
                    onChange={(event) => inline.setField("estimatedMin", event.target.value)}
                    onKeyDown={inlineFieldKeyDown("estimatedMin", false, inline.revertField, inline.flushField)}
                  />
                </InlineControl>
              ) : (
                <DetailRow label="Оценка времени" testId="task-detail-estimated">
                  {formatDurationMinutes(task.estimatedMin)}
                </DetailRow>
              )}

              <DetailRow label="Затрачено времени" testId="task-detail-time-spent">
                {formatDurationMinutes(task.timeSpentMin)}
              </DetailRow>

              <DetailRow label="Прогноз завершения" testId="task-detail-completion-prediction">
                {completionPredictionLabel(prediction)}
              </DetailRow>

              <DetailRow label="Создано" testId="task-detail-created">
                {formatDate(task.createdAt)}
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

            {inlineEnabled ? (
              <InlineControl
                field="description"
                label="Описание"
                testId="task-detail-description"
                status={inline.statusOf("description")}
                message={inline.messageOf("description")}
              >
                <Textarea
                  id="task-inline-description"
                  value={inline.values.description}
                  aria-busy={inline.statusOf("description") === "saving" || undefined}
                  aria-invalid={isFieldInvalid(inline.statusOf("description")) || undefined}
                  aria-describedby="task-inline-description-status"
                  className="max-h-48 min-h-16 min-w-0"
                  onChange={(event) => inline.setField("description", event.target.value)}
                  onKeyDown={inlineFieldKeyDown("description", true, inline.revertField, inline.flushField)}
                />
              </InlineControl>
            ) : (
              <DetailRow label="Описание" testId="task-detail-description">
                {task.description || "Без описания"}
              </DetailRow>
            )}

            {inlineEnabled ? (
              <InlineControl
                field="tags"
                label="Теги (через запятую)"
                testId="task-detail-tags"
                status={inline.statusOf("tags")}
                message={inline.messageOf("tags")}
              >
                <Input
                  id="task-inline-tags"
                  value={inline.values.tags}
                  aria-busy={inline.statusOf("tags") === "saving" || undefined}
                  aria-invalid={isFieldInvalid(inline.statusOf("tags")) || undefined}
                  aria-describedby="task-inline-tags-status"
                  onChange={(event) => inline.setField("tags", event.target.value)}
                  onKeyDown={inlineFieldKeyDown("tags", false, inline.revertField, inline.flushField)}
                />
              </InlineControl>
            ) : (
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
            )}

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
                <div className="flex flex-col gap-2">
                  <ul className="flex flex-col gap-1.5">
                    {pagedSubtasks.map((subtask) => (
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
                  <PaginationBar
                    page={subtaskPage}
                    totalPages={subtaskPages}
                    onPageChange={setSubtaskPage}
                    data-testid="task-detail-subtask-pagination"
                  />
                </div>
              </DetailRow>
            )}

            <TaskAgeCounter task={task} />
            <TaskTimer task={task} canEdit={canEdit} onTaskUpdated={handleTaskUpdated} workDayHours={workDayHours} />

            <TaskComments taskId={task.id} canComment={canEdit} />

            <TaskActivity taskId={task.id} />

            <TaskAttachments taskId={task.id} canManage={canEdit} />

            <div className="flex flex-col gap-4 border-t border-border pt-4">
              {canEdit && <TaskRollback task={task} onTaskUpdated={handleTaskUpdated} />}

              <div className="flex flex-wrap items-end justify-between gap-2">
                <TaskExportActions task={task} listTasks={listTasks} />

                {canEdit && (
                  <div className="flex flex-col items-end gap-1.5">
                    {cloneError && (
                      <p
                        role="alert"
                        data-testid="task-detail-clone-error"
                        className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      >
                        {cloneError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        data-testid="task-detail-clone"
                        disabled={isCloning}
                        onClick={handleClone}
                      >
                        {isCloning ? "Клонирование..." : "Клонировать"}
                      </Button>
                      <Button data-testid="task-detail-edit" onClick={() => setMode("edit")}>
                        Редактировать
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
