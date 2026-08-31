"use client";

import { useCallback } from "react";
import { Loader2Icon } from "lucide-react";
import type { DeletedListSummary } from "@/features/dashboard/dashboard-lists";
import type { TaskList } from "@/entities/list/schema";
import { useRestoreList } from "@/features/list/use-restore-list";
import { usePagedItems } from "@/shared/lib/use-paged-items";
import { Button } from "@/shared/ui/button";
import { PaginationBar } from "@/shared/ui/pagination";
import { formatDateTime } from "@/shared/lib/format-date";

interface DeletedListsSectionProps {
  lists: DeletedListSummary[];
  onRestored: (list: TaskList) => void;
}

function DeletedListRow({
  list,
  onRestored,
}: {
  list: DeletedListSummary;
  onRestored: (list: TaskList) => void;
}) {
  const { restoreList, isPending, error } = useRestoreList();

  const handleRestore = useCallback(async () => {
    const restored = await restoreList(list.id);
    if (restored) {
      onRestored(restored);
    }
  }, [list.id, onRestored, restoreList]);

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{list.title}</span>
        <span className="text-xs text-muted-foreground">
          Удалён {formatDateTime(list.deletedAt)}
        </span>
      </div>

      <div className="flex flex-col items-end gap-1">
        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleRestore}>
          {isPending ? (
            <>
              <Loader2Icon className="animate-spin" aria-hidden="true" />
              Восстановление...
            </>
          ) : (
            "Восстановить"
          )}
        </Button>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

export function DeletedListsSection({ lists, onRestored }: DeletedListsSectionProps) {
  const { page, setPage, totalPages, pageItems } = usePagedItems(lists);

  if (lists.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="deleted-lists-heading" className="flex flex-col gap-2">
      <h2 id="deleted-lists-heading" className="text-sm font-medium text-muted-foreground">
        Удалённые списки
      </h2>
      <ul className="flex flex-col gap-2">
        {pageItems.map((list) => (
          <DeletedListRow key={list.id} list={list} onRestored={onRestored} />
        ))}
      </ul>
      <PaginationBar
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        data-testid="deleted-lists-pagination"
      />
    </section>
  );
}
