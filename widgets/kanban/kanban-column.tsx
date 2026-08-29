"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { TaskStatus } from "@/entities/task/schema";
import { cn } from "@/shared/lib/utils";

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  children: ReactNode;
}

export function KanbanColumn({ status, title, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      data-testid={`kanban-column-${status}`}
      aria-label={title}
      className={cn(
        "flex min-h-[12rem] w-[min(100%,20rem)] shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3",
        isOver && "border-ring",
      )}
    >
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="flex min-h-16 flex-col gap-2">{children}</div>
    </section>
  );
}
