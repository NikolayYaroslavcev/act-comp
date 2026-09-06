"use client";

import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import type { z } from "zod";

import { createTaskInputSchema, type CreateTaskInput } from "@/entities/task/requests";
import type { Task } from "@/entities/task/schema";
import { useCreateTask } from "@/features/task/use-create-task";
import { Button } from "@/shared/ui/button";
import { DatePicker } from "@/shared/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

type CreateTaskFormValues = z.input<typeof createTaskInputSchema>;

interface CreateTaskDialogProps {
  listId: string;
  onCreated: (task: Task) => void;
}

function defaultValues(listId: string): CreateTaskFormValues {
  return { listId, title: "", description: "", tags: [], parentId: null, deadline: null };
}

export function CreateTaskDialog({ listId, onCreated }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const { createTask, isPending, error } = useCreateTask();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateTaskFormValues, unknown, CreateTaskInput>({
    resolver: zodResolver(createTaskInputSchema),
    mode: "onSubmit",
    defaultValues: defaultValues(listId),
  });

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        reset(defaultValues(listId));
      }
    },
    [listId, reset],
  );

  const onSubmit = useCallback(
    async (values: CreateTaskInput) => {
      if (isPending) {
        return;
      }
      const created = await createTask(values);
      if (created) {
        onCreated(created);
        handleOpenChange(false);
      }
    },
    [createTask, handleOpenChange, isPending, onCreated],
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>Создать задачу</Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая задача</DialogTitle>
          </DialogHeader>

          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-task-title">Название</Label>
              <Input
                id="create-task-title"
                autoFocus
                disabled={isPending}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "create-task-title-error" : undefined}
                {...register("title")}
              />
              {errors.title && (
                <p id="create-task-title-error" role="alert" className="text-sm text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-task-description">Описание</Label>
              <Textarea
                id="create-task-description"
                disabled={isPending}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={errors.description ? "create-task-description-error" : undefined}
                {...register("description")}
              />
              {errors.description && (
                <p id="create-task-description-error" role="alert" className="text-sm text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-task-deadline">Дедлайн (необязательно)</Label>
              <Controller
                control={control}
                name="deadline"
                render={({ field }) => (
                  <DatePicker
                    id="create-task-deadline"
                    includeTime
                    disabled={isPending}
                    value={field.value ? new Date(field.value) : null}
                    onChange={(date) => field.onChange(date ? date.toISOString() : null)}
                  />
                )}
              />
              {errors.deadline && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.deadline.message}
                </p>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={isPending} onClick={() => handleOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2Icon className="animate-spin" aria-hidden="true" />
                    Создание...
                  </>
                ) : (
                  "Создать"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
