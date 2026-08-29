"use client";

import { useCallback, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Task } from "@/entities/task/schema";
import { taskPrioritySchema, taskSchema, taskStatusSchema } from "@/entities/task/schema";
import type { UpdateTaskInput } from "@/entities/task/requests";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

interface TaskEditFormProps {
  task: Task;
  listTasks: Task[];
  isPending: boolean;
  onSubmit: (patch: UpdateTaskInput | null) => void;
  onCancel: () => void;
}

const STATUS_LABELS = {
  new: "Новая",
  in_progress: "В работе",
  done: "Готово",
} as const;

const FIELD_ERROR_MESSAGES = {
  title: "Укажите название задачи (не более 300 символов)",
  description: "Слишком длинное описание",
  priority: "Приоритет должен быть числом от 1 до 5",
  estimatedMin: "Оценка времени не может быть отрицательной",
} as const;

const taskEditFormSchema = z.object({
  title: taskSchema.shape.title,
  description: taskSchema.shape.description,
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  category: z.string(),
  tags: z.string(),
  deadline: z.string().refine((value) => value === "" || !Number.isNaN(Date.parse(value)), {
    message: "Некорректная дата",
  }),
  estimatedMin: taskSchema.shape.estimatedMin,
  dependsOn: z.array(z.string()),
  parentId: z.string(),
});

type TaskEditFormValues = z.infer<typeof taskEditFormSchema>;

function toFormValues(task: Task): TaskEditFormValues {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    category: task.category ?? "",
    tags: task.tags.join(", "),
    deadline: task.deadline ? task.deadline.slice(0, 10) : "",
    estimatedMin: task.estimatedMin,
    dependsOn: task.dependsOn,
    parentId: task.parentId ?? "",
  };
}

export function TaskEditForm({ task, listTasks, isPending, onSubmit, onCancel }: TaskEditFormProps) {
  const {
    control,
    formState: { errors, dirtyFields },
    handleSubmit,
    register,
    reset,
  } = useForm<TaskEditFormValues>({
    resolver: zodResolver(taskEditFormSchema),
    mode: "onSubmit",
    defaultValues: toFormValues(task),
  });

  useEffect(() => {
    reset(toFormValues(task));
  }, [task, reset]);

  const onValid = useCallback(
    (values: TaskEditFormValues) => {
      const patch: UpdateTaskInput = {};

      if (dirtyFields.title) patch.title = values.title.trim();
      if (dirtyFields.description) patch.description = values.description;
      if (dirtyFields.status) patch.status = values.status;
      if (dirtyFields.priority) patch.priority = values.priority;
      if (dirtyFields.category) patch.category = values.category.trim() === "" ? null : values.category.trim();
      if (dirtyFields.tags) {
        patch.tags = values.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0);
      }
      if (dirtyFields.deadline) {
        patch.deadline = values.deadline === "" ? null : new Date(`${values.deadline}T00:00:00.000Z`).toISOString();
      }
      if (dirtyFields.estimatedMin) patch.estimatedMin = values.estimatedMin;
      if (dirtyFields.dependsOn) patch.dependsOn = values.dependsOn;
      if (dirtyFields.parentId) patch.parentId = values.parentId === "" ? null : values.parentId;

      onSubmit(Object.keys(patch).length > 0 ? patch : null);
    },
    [dirtyFields, onSubmit],
  );

  const candidateTasks = listTasks.filter((candidate) => candidate.id !== task.id && candidate.deletedAt === null);

  return (
    <form
      noValidate
      data-testid="task-edit-form"
      onSubmit={handleSubmit(onValid)}
      className="flex flex-col gap-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="task-edit-title">Название</Label>
        <Input
          id="task-edit-title"
          disabled={isPending}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "task-edit-title-error" : undefined}
          {...register("title")}
        />
        {errors.title && (
          <p id="task-edit-title-error" role="alert" className="text-sm text-destructive">
            {FIELD_ERROR_MESSAGES.title}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-edit-description">Описание</Label>
        <Textarea
          id="task-edit-description"
          disabled={isPending}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? "task-edit-description-error" : undefined}
          {...register("description")}
        />
        {errors.description && (
          <p id="task-edit-description-error" role="alert" className="text-sm text-destructive">
            {FIELD_ERROR_MESSAGES.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="task-edit-status">Статус</Label>
          <Select id="task-edit-status" disabled={isPending} {...register("status")}>
            {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-edit-priority">Приоритет</Label>
          <Input
            id="task-edit-priority"
            type="number"
            min={1}
            max={5}
            step={1}
            disabled={isPending}
            aria-invalid={errors.priority ? true : undefined}
            aria-describedby={errors.priority ? "task-edit-priority-error" : undefined}
            {...register("priority", { valueAsNumber: true })}
          />
          {errors.priority && (
            <p id="task-edit-priority-error" role="alert" className="text-sm text-destructive">
              {FIELD_ERROR_MESSAGES.priority}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-edit-category">Категория</Label>
          <Input id="task-edit-category" disabled={isPending} {...register("category")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-edit-deadline">Дедлайн</Label>
          <Input
            id="task-edit-deadline"
            type="date"
            disabled={isPending}
            aria-invalid={errors.deadline ? true : undefined}
            aria-describedby={errors.deadline ? "task-edit-deadline-error" : undefined}
            {...register("deadline")}
          />
          {errors.deadline && (
            <p id="task-edit-deadline-error" role="alert" className="text-sm text-destructive">
              {errors.deadline.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-edit-estimated">Оценка времени (мин)</Label>
          <Input
            id="task-edit-estimated"
            type="number"
            min={0}
            step={1}
            disabled={isPending}
            aria-invalid={errors.estimatedMin ? true : undefined}
            aria-describedby={errors.estimatedMin ? "task-edit-estimated-error" : undefined}
            {...register("estimatedMin", { valueAsNumber: true })}
          />
          {errors.estimatedMin && (
            <p id="task-edit-estimated-error" role="alert" className="text-sm text-destructive">
              {FIELD_ERROR_MESSAGES.estimatedMin}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-edit-parent">Родительская задача</Label>
          <Select id="task-edit-parent" disabled={isPending} {...register("parentId")}>
            <option value="">Без родителя</option>
            {candidateTasks.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.code} — {candidate.title}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-edit-tags">Теги (через запятую)</Label>
        <Input id="task-edit-tags" disabled={isPending} {...register("tags")} />
      </div>

      <div className="space-y-1.5">
        <span className="text-sm leading-none font-medium">Зависит от</span>
        <div className="flex flex-col gap-2">
          {candidateTasks.length === 0 && (
            <p className="text-xs text-muted-foreground">Нет доступных задач</p>
          )}
          <Controller
            control={control}
            name="dependsOn"
            render={({ field }) => (
              <>
                {candidateTasks.map((candidate) => {
                  const checked = field.value.includes(candidate.id);
                  return (
                    <div key={candidate.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`task-edit-dependson-${candidate.id}`}
                        checked={checked}
                        disabled={isPending}
                        onCheckedChange={(next) => {
                          field.onChange(
                            next
                              ? [...field.value, candidate.id]
                              : field.value.filter((id) => id !== candidate.id),
                          );
                        }}
                      />
                      <Label htmlFor={`task-edit-dependson-${candidate.id}`} className="font-normal">
                        {candidate.code} — {candidate.title}
                      </Label>
                    </div>
                  );
                })}
              </>
            )}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          data-testid="task-edit-cancel"
          disabled={isPending}
          onClick={onCancel}
        >
          Отмена
        </Button>
        <Button type="submit" data-testid="task-edit-save" disabled={isPending}>
          Сохранить
        </Button>
      </div>
    </form>
  );
}
