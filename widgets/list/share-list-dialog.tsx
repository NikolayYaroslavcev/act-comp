"use client";

import { useCallback, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { z } from "zod";

import type { ShareListInput } from "@/entities/list/requests";
import type { ListShare, SharedAccess, TaskList } from "@/entities/list/schema";
import { sharedAccessSchema } from "@/entities/list/schema";
import { useShareList } from "@/features/list/use-share-list";
import { usePagedItems } from "@/shared/lib/use-paged-items";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { PaginationBar } from "@/shared/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

const ACCESS_OPTIONS: { value: SharedAccess; label: string }[] = [
  { value: "read", label: "Только чтение" },
  { value: "edit", label: "Редактирование" },
];

const shareListFormSchema = z
  .object({
    recipient: z.string().trim().min(1, "Укажите email или идентификатор пользователя"),
    access: sharedAccessSchema,
  })
  .superRefine((value, ctx) => {
    if (value.recipient.includes("@")) {
      const parsed = z.email().safeParse(value.recipient);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", path: ["recipient"], message: "Введите корректный email" });
      }
    }
  });

type ShareListFormValues = z.infer<typeof shareListFormSchema>;

const DEFAULT_VALUES: ShareListFormValues = { recipient: "", access: "read" };

function toShareInput(values: ShareListFormValues): ShareListInput {
  if (values.recipient.includes("@")) {
    return { email: values.recipient, access: values.access };
  }
  return { userId: values.recipient, access: values.access };
}

interface ShareListDialogProps {
  list: TaskList;
  onShared?: (list: TaskList) => void;
}

export function ShareListDialog({ list, onShared }: ShareListDialogProps) {
  const [open, setOpen] = useState(false);
  const [trackedListId, setTrackedListId] = useState(list.id);
  const [sharesFromMutation, setSharesFromMutation] = useState<ListShare[] | null>(null);
  const { shareList, isPending, error } = useShareList();

  if (list.id !== trackedListId) {
    setTrackedListId(list.id);
    setSharesFromMutation(null);
  }

  const displayedShares = sharesFromMutation ?? list.sharedWith;
  const { page, setPage, totalPages, pageItems } = usePagedItems(displayedShares);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<ShareListFormValues>({
    resolver: zodResolver(shareListFormSchema),
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

  const applyUpdatedList = useCallback(
    (updated: TaskList) => {
      setSharesFromMutation(updated.sharedWith);
      onShared?.(updated);
    },
    [onShared],
  );

  const onSubmit = useCallback(
    async (values: ShareListFormValues) => {
      if (isPending) {
        return;
      }
      const updated = await shareList(list.id, toShareInput(values));
      if (updated) {
        applyUpdatedList(updated);
        reset(DEFAULT_VALUES);
      }
    },
    [applyUpdatedList, isPending, list.id, reset, shareList],
  );

  const onChangeAccess = useCallback(
    async (userId: string, access: SharedAccess) => {
      if (isPending) {
        return;
      }
      const updated = await shareList(list.id, { userId, access });
      if (updated) {
        applyUpdatedList(updated);
      }
    },
    [applyUpdatedList, isPending, list.id, shareList],
  );

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Поделиться
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Поделиться списком</DialogTitle>
            <DialogDescription>Управление доступом доступно только владельцу списка.</DialogDescription>
          </DialogHeader>

          {displayedShares.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="share-list-empty">
              Пока никому не предоставлен доступ
            </p>
          ) : (
            <div className="flex min-w-0 flex-col gap-2">
              <ul className="flex min-w-0 flex-col gap-2">
                {pageItems.map((share) => (
                <li
                  key={share.userId}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-2"
                  data-testid={`share-row-${share.userId}`}
                >
                  <span className="min-w-0 flex-1 break-words text-sm" data-testid={`share-user-${share.userId}`}>
                    {share.userId}
                  </span>
                  <Select
                    items={ACCESS_OPTIONS}
                    value={share.access}
                    onValueChange={(value) => {
                      if (value === "read" || value === "edit") {
                        void onChangeAccess(share.userId, value);
                      }
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger
                      aria-label={`Доступ для ${share.userId}`}
                      data-testid={`share-access-${share.userId}`}
                      className="w-full min-w-0 sm:w-[11.5rem]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} label={option.label}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
              </ul>
              <PaginationBar
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                data-testid="share-list-pagination"
              />
            </div>
          )}

          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="share-list-recipient">Email или идентификатор</Label>
              <Input
                id="share-list-recipient"
                autoFocus
                disabled={isPending}
                aria-invalid={errors.recipient ? true : undefined}
                aria-describedby={errors.recipient ? "share-list-recipient-error" : undefined}
                {...register("recipient")}
              />
              {errors.recipient && (
                <p id="share-list-recipient-error" role="alert" className="text-sm text-destructive">
                  {errors.recipient.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="share-list-access">Доступ</Label>
              <Controller
                control={control}
                name="access"
                render={({ field }) => (
                  <Select
                    items={ACCESS_OPTIONS}
                    value={field.value}
                    onValueChange={(value) => value && field.onChange(value)}
                    disabled={isPending}
                  >
                    <SelectTrigger id="share-list-access">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} label={option.label}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
                    Добавление...
                  </>
                ) : (
                  "Добавить"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
