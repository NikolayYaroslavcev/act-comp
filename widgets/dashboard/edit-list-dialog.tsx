"use client";

import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PencilIcon } from "lucide-react";
import type { z } from "zod";

import { createListInputSchema, type CreateListInput } from "@/entities/list/requests";
import type { ListTemplate, TaskList } from "@/entities/list/schema";
import { useUpdateList } from "@/features/list/use-update-list";
import { Button } from "@/shared/ui/button";
import { DatePicker } from "@/shared/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

type EditListFormValues = z.input<typeof createListInputSchema>;

const TEMPLATE_OPTIONS: { value: ListTemplate; label: string }[] = [
  { value: "work", label: "Работа" },
  { value: "personal", label: "Личное" },
  { value: "project", label: "Проект" },
];

interface EditableList {
  id: string;
  title: string;
  template: ListTemplate;
  deadline: string | null;
}

function toFormValues(list: EditableList): EditListFormValues {
  return { title: list.title, template: list.template, deadline: list.deadline };
}

interface EditListDialogProps {
  list: EditableList;
  onUpdated?: (list: TaskList) => void;
}

export function EditListDialog({ list, onUpdated }: EditListDialogProps) {
  const [open, setOpen] = useState(false);
  const { updateList, isPending, error } = useUpdateList();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<EditListFormValues, unknown, CreateListInput>({
    resolver: zodResolver(createListInputSchema),
    mode: "onSubmit",
    defaultValues: toFormValues(list),
  });

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      reset(toFormValues(list));
    },
    [list, reset],
  );

  const onSubmit = useCallback(
    async (values: CreateListInput) => {
      if (isPending) {
        return;
      }
      const updated = await updateList(list.id, values);
      if (updated) {
        onUpdated?.(updated);
        setOpen(false);
      }
    },
    [isPending, list.id, onUpdated, updateList],
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground"
        aria-label={`Редактировать список «${list.title}»`}
        onClick={() => {
          reset(toFormValues(list));
          setOpen(true);
        }}
      >
        <PencilIcon aria-hidden="true" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать список</DialogTitle>
          </DialogHeader>

          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-list-title">Название</Label>
              <Input
                id="edit-list-title"
                autoFocus
                disabled={isPending}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "edit-list-title-error" : undefined}
                {...register("title")}
              />
              {errors.title && (
                <p id="edit-list-title-error" role="alert" className="text-sm text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-list-template">Шаблон</Label>
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
                    <SelectTrigger id="edit-list-template">
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
              <Label htmlFor="edit-list-deadline">Дедлайн (необязательно)</Label>
              <Controller
                control={control}
                name="deadline"
                render={({ field }) => (
                  <DatePicker
                    id="edit-list-deadline"
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
                    Сохранение...
                  </>
                ) : (
                  "Сохранить"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
