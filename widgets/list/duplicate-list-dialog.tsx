"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CopyIcon, Loader2Icon } from "lucide-react";
import type { TaskList } from "@/entities/list/schema";
import { useDuplicateList } from "@/features/list/use-duplicate-list";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";

interface DuplicateListDialogProps {
  list: { id: string; title: string };
  onDuplicated?: (list: TaskList) => void;
}

export function DuplicateListDialog({ list, onDuplicated }: DuplicateListDialogProps) {
  const [open, setOpen] = useState(false);
  const [copyTasks, setCopyTasks] = useState(false);
  const [copySharedWith, setCopySharedWith] = useState(false);
  const [duplicated, setDuplicated] = useState<TaskList | null>(null);
  const { duplicateList, isPending, error } = useDuplicateList();

  const resetForm = useCallback(() => {
    setCopyTasks(false);
    setCopySharedWith(false);
    setDuplicated(null);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        resetForm();
      }
    },
    [resetForm],
  );

  const handleSubmit = useCallback(async () => {
    if (isPending) {
      return;
    }
    const result = await duplicateList(list.id, { copyTasks, copySharedWith });
    if (result) {
      setDuplicated(result);
      onDuplicated?.(result);
    }
  }, [copySharedWith, copyTasks, duplicateList, isPending, list.id, onDuplicated]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Дублировать список «${list.title}»`}
        onClick={() => setOpen(true)}
      >
        <CopyIcon aria-hidden="true" />
        Дублировать
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Дублировать список</DialogTitle>
            <DialogDescription>Создаёт новую копию списка «{list.title}», которой владеете вы.</DialogDescription>
          </DialogHeader>

          {duplicated ? (
            <div className="flex flex-col gap-4" data-testid="duplicate-list-success">
              <p className="text-sm text-muted-foreground">Список успешно продублирован:</p>
              <Link href={`/lists/${duplicated.id}`} className="text-sm font-medium text-primary underline underline-offset-4">
                {duplicated.title}
              </Link>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Готово
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="duplicate-list-copy-tasks"
                  checked={copyTasks}
                  onCheckedChange={(value) => setCopyTasks(value === true)}
                  disabled={isPending}
                />
                <Label htmlFor="duplicate-list-copy-tasks" className="font-normal">
                  Скопировать задачи
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="duplicate-list-copy-shared"
                  checked={copySharedWith}
                  onCheckedChange={(value) => setCopySharedWith(value === true)}
                  disabled={isPending}
                />
                <Label htmlFor="duplicate-list-copy-shared" className="font-normal">
                  Скопировать доступ (пользователи, с которыми поделились списком)
                </Label>
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
                <Button type="button" disabled={isPending} onClick={handleSubmit}>
                  {isPending ? (
                    <>
                      <Loader2Icon className="animate-spin" aria-hidden="true" />
                      Дублирование...
                    </>
                  ) : (
                    "Дублировать"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
