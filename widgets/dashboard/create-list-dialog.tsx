"use client";

import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import type { z } from "zod";

import { createListInputSchema, type CreateListInput } from "@/entities/list/requests";
import type { ListTemplate } from "@/entities/list/schema";
import type { TaskList } from "@/entities/list/schema";
import { useCreateList } from "@/features/list/use-create-list";
import { Button } from "@/shared/ui/button";
import { DatePicker } from "@/shared/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

type CreateListFormValues = z.input<typeof createListInputSchema>;

const TEMPLATE_OPTIONS: { value: ListTemplate; label: string }[] = [
  { value: "work", label: "Работа" },
  { value: "personal", label: "Личное" },
  { value: "project", label: "Проект" },
];

const DEFAULT_VALUES: CreateListFormValues = { title: "", template: "work", deadline: null };

interface CreateListDialogProps {
  onCreated: (list: TaskList) => void;
}

export function CreateListDialog({ onCreated }: CreateListDialogProps) {
  const [open, setOpen] = useState(false);
  const { createList, isPending, error } = useCreateList();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<CreateListFormValues, unknown, CreateListInput>({
    resolver: zodResolver(createListInputSchema),
    mode: "onSubmit",
    defaultValues: DEFAULT_VALUES,
  });

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        reset(DEFAULT_VALUES);
      }
    },
    [reset],
  );

  const onSubmit = useCallback(
    async (values: CreateListInput) => {
      if (isPending) {
        return;
      }
      const created = await createList(values);
      if (created) {
        onCreated(created);
        handleOpenChange(false);
      }
    },
    [createList, handleOpenChange, isPending, onCreated],
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>Создать список</Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый список</DialogTitle>
          </DialogHeader>

          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-list-title">Название</Label>
              <Input
                id="create-list-title"
                autoFocus
                disabled={isPending}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "create-list-title-error" : undefined}
                {...register("title")}
              />
              {errors.title && (
                <p id="create-list-title-error" role="alert" className="text-sm text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-list-template">Шаблон</Label>
              <Controller
                control={control}
                name="template"
                render={({ field }) => (
                  <Select
                    items={TEMPLATE_OPTIONS}
                    value={field.value}
                    onValueChange={(value) => value && field.onChange(value)}
                    disabled={isPending}
                  >
                    <SelectTrigger id="create-list-template">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} label={option.label}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.template && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.template.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-list-deadline">Дедлайн (необязательно)</Label>
              <Controller
                control={control}
                name="deadline"
                render={({ field }) => (
                  <DatePicker
                    id="create-list-deadline"
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
