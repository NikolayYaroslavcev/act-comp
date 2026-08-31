"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { TaskStatus } from "@/entities/task/schema";
import { cn } from "@/shared/lib/utils";

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  count?: number;
  isEmpty?: boolean;
  children: ReactNode;
}

export function KanbanColumn({ status, title, count, isEmpty = false, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      data-testid={`kanban-column-${status}`}
      aria-label={title}
      className={cn(
        "flex min-h-[12rem] w-[min(100%,20rem)] shrink-0 flex-col gap-2 rounded-lg p-1.5",
        isOver && "bg-accent/60",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-0.5 pb-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      <div className="flex min-h-16 flex-col gap-2">
        {isEmpty ? (
          <p className="text-xs text-muted-foreground" data-testid="kanban-column-empty">
            Нет задач в этой колонке
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
