import { memo } from "react";
import type { Task } from "@/entities/task/schema";
import { isTaskOverdue } from "@/entities/task/model";
import { Badge } from "@/shared/ui/badge";
import { HighlightedText } from "@/shared/ui/highlighted-text";
import { cn } from "@/shared/lib/utils";
import { formatDate } from "@/shared/lib/format-date";

interface TaskRowProps {
  task: Task;
  dependencyCodes: string[];
  now?: Date;
  searchQuery?: string;
  onOpen?: (task: Task) => void;
}

const STATUS_LABELS = {
  new: "Новая",
  in_progress: "В работе",
  done: "Готово",
} as const;

const STATUS_BADGE_VARIANT = {
  new: "outline",
  in_progress: "default",
  done: "muted",
} as const;

export const TaskRow = memo(function TaskRow({ task, dependencyCodes, now = new Date(), searchQuery, onOpen }: TaskRowProps) {
  const overdue = isTaskOverdue(task, now);
  const completed = task.status === "done";

  const rowClassName = cn(
    "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
    onOpen && "w-full text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring",
  );

  const content = (
    <>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            <HighlightedText text={task.code} query={searchQuery} />
          </span>
          <span className={cn("text-sm font-semibold break-words", completed && "line-through")}>
            <HighlightedText text={task.title} query={searchQuery} />
          </span>
          {overdue && (
            <Badge
              variant="outline"
              data-testid="task-overdue-badge"
              className="border-destructive/40 text-destructive"
            >
              Просрочено
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {task.category !== null && (
            <Badge variant="muted" data-testid="task-category">
              <HighlightedText text={task.category} query={searchQuery} />
            </Badge>
          )}
          {task.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              #<HighlightedText text={tag} query={searchQuery} />
            </Badge>
          ))}
          {dependencyCodes.length > 0 && (
            <span className="text-xs text-muted-foreground" data-testid="task-dependencies">
              Зависит от: {dependencyCodes.join(", ")}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
        <Badge variant={STATUS_BADGE_VARIANT[task.status]} data-testid="task-status">
          {STATUS_LABELS[task.status]}
        </Badge>
        <span className="text-muted-foreground" data-testid="task-priority">
          Приоритет: {task.priority}
        </span>
        <span
          className={cn("tabular-nums text-muted-foreground", overdue && "font-medium text-destructive")}
          data-testid="task-deadline"
        >
          {task.deadline ? formatDate(task.deadline) : "Без дедлайна"}
        </span>
      </div>
    </>
  );

  return (
    <li className={cn(completed && "opacity-60")}>
      {onOpen ? (
        <button type="button" data-testid="task-row" onClick={() => onOpen(task)} className={rowClassName}>
          {content}
        </button>
      ) : (
        <div data-testid="task-row" className={rowClassName}>
          {content}
        </div>
      )}
    </li>
  );
});
