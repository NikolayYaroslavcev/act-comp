import type { DashboardListSummary } from "@/features/dashboard/dashboard-lists";
import { ListCard } from "./list-card";

interface ListsSectionProps {
  lists: DashboardListSummary[];
}

export function ListsSection({ lists }: ListsSectionProps) {
  if (lists.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="lists-empty-state">
        У вас пока нет списков.
      </p>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lists.map((list) => (
        <ListCard key={list.id} list={list} />
      ))}
    </div>
  );
}
