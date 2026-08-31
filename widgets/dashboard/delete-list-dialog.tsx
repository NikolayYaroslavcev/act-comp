"use client";

import { useCallback, useState } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import type { TaskList } from "@/entities/list/schema";
import { useDeleteList } from "@/features/list/use-delete-list";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

interface DeleteListDialogProps {
  list: { id: string; title: string };
  onDeleted?: (list: TaskList) => void;
}

export function DeleteListDialog({ list, onDeleted }: DeleteListDialogProps) {
  const [open, setOpen] = useState(false);
  const { deleteList, isPending, error } = useDeleteList();

  const handleConfirm = useCallback(async () => {
    if (isPending) {
      return;
    }
    const deleted = await deleteList(list.id);
    if (deleted) {
      setOpen(false);
      onDeleted?.(deleted);
    }
  }, [deleteList, isPending, list.id, onDeleted]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Удалить список «${list.title}»`}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon aria-hidden="true" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить список?</DialogTitle>
            <DialogDescription>
              Список «{list.title}» будет удалён. Его можно будет восстановить в течение 30 дней.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="button" variant="destructive" disabled={isPending} onClick={handleConfirm}>
              {isPending ? (
                <>
                  <Loader2Icon className="animate-spin" aria-hidden="true" />
                  Удаление...
                </>
              ) : (
                "Удалить"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
