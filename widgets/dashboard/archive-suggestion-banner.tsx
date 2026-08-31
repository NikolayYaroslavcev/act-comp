"use client";

import { useCallback, useState } from "react";
import { ArchiveIcon, Loader2Icon } from "lucide-react";
import type { TaskList } from "@/entities/list/schema";
import { useDeleteList } from "@/features/list/use-delete-list";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

interface ArchiveSuggestionBannerProps {
  list: { id: string; title: string };
  onArchived?: (list: TaskList) => void;
}

/**
 * Surfaces entities/list/model.ts:isListArchiveCandidate (computed into
 * DashboardListSummary.isArchiveCandidate) as an opt-in suggestion, per the
 * ТЗ ("списки без активности 30+ дней предлагаются к архивации") — never
 * archives automatically. There is no separate "archived" state in the list
 * schema, so confirming reuses the existing soft-delete mechanism
 * (useDeleteList -> DELETE /api/lists/:id), identical to DeleteListDialog,
 * recoverable for 30 days like any other deleted list.
 */
export function ArchiveSuggestionBanner({ list, onArchived }: ArchiveSuggestionBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { deleteList, isPending, error } = useDeleteList();

  const handleConfirm = useCallback(async () => {
    if (isPending) {
      return;
    }
    const archived = await deleteList(list.id);
    if (archived) {
      setConfirmOpen(false);
      onArchived?.(archived);
    }
  }, [deleteList, isPending, list.id, onArchived]);

  if (dismissed) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
      data-testid="archive-suggestion-banner"
    >
      <p className="text-warning">Список давно не активен. Архивировать?</p>
      <div className="flex shrink-0 gap-1.5">
        <Button type="button" size="xs" variant="outline" onClick={() => setDismissed(true)}>
          Не сейчас
        </Button>
        <Button type="button" size="xs" variant="outline" onClick={() => setConfirmOpen(true)}>
          <ArchiveIcon aria-hidden="true" />
          Архивировать
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Архивировать список?</DialogTitle>
            <DialogDescription>
              Список «{list.title}» будет удалён. Его можно будет восстановить в течение 30 дней, как и любой
              удалённый список.
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
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={isPending} onClick={handleConfirm}>
              {isPending ? (
                <>
                  <Loader2Icon className="animate-spin" aria-hidden="true" />
                  Архивирование...
                </>
              ) : (
                "Подтвердить"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
