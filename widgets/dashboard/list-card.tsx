import Link from "next/link";
import type { DashboardListSummary } from "@/features/dashboard/dashboard-lists";
import type { ListUrgency } from "@/entities/list/model";
import type { TaskList } from "@/entities/list/schema";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Progress } from "@/shared/ui/progress";
import { formatDateTime } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";
import { ArchiveSuggestionBanner } from "./archive-suggestion-banner";
import { DeleteListDialog } from "./delete-list-dialog";
import { EditListDialog } from "./edit-list-dialog";

const URGENCY_BADGE_LABEL: Record<Exclude<ListUrgency, "normal">, string> = {
  urgent: "Просрочено",
  warning: "Скоро дедлайн",
};

const URGENCY_BADGE_CLASSNAME: Record<Exclude<ListUrgency, "normal">, string> = {
  urgent: "border-destructive/40 text-destructive",
  warning: "border-warning/40 text-warning",
};

interface ListCardProps {
  list: DashboardListSummary;
  onDeleted?: (list: TaskList) => void;
  onUpdated?: (list: TaskList) => void;
  className?: string;
}

const STATUS_LABELS = {
  new: "Новые",
  in_progress: "В работе",
  done: "Готово",
} as const;

export function ListCard({ list, onDeleted, onUpdated, className }: ListCardProps) {
  return (
    // The delete trigger + confirmation dialog render as a sibling overlay,
    // not a descendant of the <Link>: React bubbles portal-rendered content
    // (the dialog) along the *component* tree rather than the DOM tree, so
    // nesting it inside the Link would let a click on Cancel/Delete bubble
    // up into the Link's navigation handler.
    <div className={cn("relative", className)}>
      <Link
        href={`/lists/${list.id}`}
        data-testid="list-card"
        className="block cursor-pointer rounded-xl transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card className="h-full hover:border-ring/50">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="min-w-0 text-base break-words">{list.title}</CardTitle>
              {list.urgency !== "normal" && (
                <Badge
                  variant="outline"
                  data-testid="list-urgency-badge"
                  className={cn("w-fit", URGENCY_BADGE_CLASSNAME[list.urgency])}
                >
                  {URGENCY_BADGE_LABEL[list.urgency]}
                </Badge>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-2xl font-semibold tabular-nums">{list.taskCount}</span>
              {/* Reserves the action buttons' footprint so the title/count
                  layout matches exactly where the real (sibling, overlaid)
                  Edit/DeleteListDialog triggers render below. */}
              <div className="flex items-center gap-1.5">
                {list.canEdit && <span aria-hidden="true" className="size-7" />}
                {list.canDelete && <span aria-hidden="true" className="size-7" />}
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {list.taskCount === 0 ? (
              <p className="text-sm text-muted-foreground">Нет задач</p>
            ) : (
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((status) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <dt className="text-muted-foreground">{STATUS_LABELS[status]}</dt>
                    <dd data-testid={`status-count-${status}`} className="font-medium tabular-nums">
                      {list.statusCounts[status]}
                    </dd>
                  </div>
                ))}
                {list.overdueCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <dt className="text-destructive">Просрочено</dt>
                    <dd data-testid="status-count-overdue" className="font-medium text-destructive tabular-nums">
                      {list.overdueCount}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Прогресс</span>
                <span className="tabular-nums">{list.progress}%</span>
              </div>
              <Progress value={list.progress} />
            </div>

            <p className="text-xs text-muted-foreground">
              {list.lastActivityAt
                ? `Активность: ${formatDateTime(list.lastActivityAt)}`
                : "Нет активности"}
            </p>
          </CardContent>
        </Card>
      </Link>

      {list.isArchiveCandidate && list.canDelete && (
        <div className="mt-2">
          <ArchiveSuggestionBanner list={{ id: list.id, title: list.title }} onArchived={onDeleted} />
        </div>
      )}

      <div className="absolute top-5 right-5 flex items-center gap-1.5">
        {list.canEdit && (
          <EditListDialog
            list={{ id: list.id, title: list.title, template: list.template, deadline: list.deadline }}
            onUpdated={onUpdated}
          />
        )}
        {list.canDelete && <DeleteListDialog list={{ id: list.id, title: list.title }} onDeleted={onDeleted} />}
      </div>
    </div>
  );
}
