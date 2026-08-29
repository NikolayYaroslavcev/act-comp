import Link from "next/link";
import type { DashboardListSummary } from "@/features/dashboard/dashboard-lists";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Progress } from "@/shared/ui/progress";

interface ListCardProps {
  list: DashboardListSummary;
}

const STATUS_LABELS = {
  new: "Новые",
  in_progress: "В работе",
  done: "Готово",
} as const;

const lastActivityFormatter = new Intl.DateTimeFormat("ru", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function ListCard({ list }: ListCardProps) {
  return (
    <Link
      href={`/lists/${list.id}`}
      data-testid="list-card"
      className="block rounded-xl transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full hover:border-ring/50">
        <CardHeader className="flex-row items-start justify-between gap-3">
          <CardTitle className="text-base">{list.title}</CardTitle>
          <span className="shrink-0 text-2xl font-semibold tabular-nums">{list.taskCount}</span>
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
              ? `Активность: ${lastActivityFormatter.format(new Date(list.lastActivityAt))}`
              : "Нет активности"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
