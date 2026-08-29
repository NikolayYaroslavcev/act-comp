import type { Task } from "@/entities/task/schema";
import type { TaskList as ListEntity } from "@/entities/list/schema";
import { calculateListProgress, canEditList, isListDeadlineOverdue } from "@/entities/list/model";
import { countTasksByStatus } from "@/entities/task/model";
import { Badge } from "@/shared/ui/badge";
import { Progress } from "@/shared/ui/progress";
import { cn } from "@/shared/lib/utils";
import { TaskList } from "./task-list";

interface ListDetailProps {
  list: ListEntity;
  tasks: Task[];
  currentUserId: string;
  now?: Date;
}

const TEMPLATE_LABELS = {
  work: "Работа",
  personal: "Личное",
  project: "Проект",
} as const;

const STATUS_LABELS = {
  new: "Новые",
  in_progress: "В работе",
  done: "Готово",
} as const;

const deadlineFormatter = new Intl.DateTimeFormat("ru", { dateStyle: "medium" });

function getAccessLabel(list: ListEntity, currentUserId: string): string {
  if (list.ownerId === currentUserId) {
    return "Владелец";
  }
  return canEditList(list, currentUserId) ? "Редактирование" : "Только чтение";
}

export function ListDetail({ list, tasks, currentUserId, now = new Date() }: ListDetailProps) {
  const progress = calculateListProgress(tasks);
  const statusCounts = countTasksByStatus(tasks);
  const deadlineOverdue = isListDeadlineOverdue(list, now);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{list.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{TEMPLATE_LABELS[list.template]}</Badge>
              <Badge variant="muted" data-testid="list-access-badge">
                {getAccessLabel(list, currentUserId)}
              </Badge>
            </div>
          </div>
          <span className="shrink-0 text-2xl font-semibold tabular-nums" data-testid="list-task-count">
            {tasks.length}
          </span>
        </div>

        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((status) => (
            <div key={status} className="flex items-center gap-1.5">
              <dt className="text-muted-foreground">{STATUS_LABELS[status]}</dt>
              <dd className="font-medium tabular-nums">{statusCounts[status]}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Прогресс</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <p className={cn("text-xs text-muted-foreground", deadlineOverdue && "font-medium text-destructive")}>
          {list.deadline
            ? `Дедлайн списка: ${deadlineFormatter.format(new Date(list.deadline))}${deadlineOverdue ? " (просрочен)" : ""}`
            : "Без дедлайна"}
        </p>
      </div>

      <TaskList
        tasks={tasks}
        now={now}
        canEdit={canEditList(list, currentUserId)}
        exportList={{ id: list.id, title: list.title }}
      />
    </div>
  );
}
