"use client";

import { usePagedItems } from "@/shared/lib/use-paged-items";
import { cn } from "@/shared/lib/utils";
import { PaginationBar } from "@/shared/ui/pagination";
import type { DashboardListSummary } from "@/features/dashboard/dashboard-lists";
import type { TaskList } from "@/entities/list/schema";
import { ListCard } from "./list-card";

interface ListsSectionProps {
  lists: DashboardListSummary[];
  onDeleted?: (list: TaskList) => void;
  onUpdated?: (list: TaskList) => void;
  /** True when `lists` is the result of an active search/filter, so an empty
   * result reads as "no matches" rather than "you have no lists at all". */
  isFiltered?: boolean;
}

const PAGE_SIZE = 9;

const ENTRANCE_DELAYS = ["", "delay-75", "delay-100", "delay-150", "delay-200", "delay-300"];

export function ListsSection({ lists, onDeleted, onUpdated, isFiltered = false }: ListsSectionProps) {
  const { page, setPage, totalPages, pageItems } = usePagedItems(lists, PAGE_SIZE);

  if (lists.length === 0) {
    return isFiltered ? (
      <p className="text-sm text-muted-foreground" data-testid="lists-empty-filtered">
        Списки не найдены. Попробуйте изменить условия поиска.
      </p>
    ) : (
      <p className="text-sm text-muted-foreground" data-testid="lists-empty-state">
        У вас пока нет списков.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map((list, index) => (
          <ListCard
            key={list.id}
            list={list}
            onDeleted={onDeleted}
            onUpdated={onUpdated}
            className={cn(
              "motion-reduce:animate-none animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out fill-mode-both",
              ENTRANCE_DELAYS[index % ENTRANCE_DELAYS.length]
            )}
          />
        ))}
      </div>
      <PaginationBar
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        data-testid="dashboard-lists-pagination"
      />
    </div>
  );
}
