"use client";

import { describeTaskActivity } from "@/entities/activity/model";
import { useTaskActivity } from "@/features/task/use-task-activity";
import { usePagedItems } from "@/shared/lib/use-paged-items";
import { Button } from "@/shared/ui/button";
import { PaginationBar } from "@/shared/ui/pagination";
import { formatDateTime } from "@/shared/lib/format-date";

interface TaskActivityProps {
  taskId: string;
}

export function TaskActivity({ taskId }: TaskActivityProps) {
  const { activity, isLoading, loadError, reload } = useTaskActivity(taskId);
  const { page, setPage, totalPages, pageItems } = usePagedItems(activity);

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4" data-testid="task-activity" aria-labelledby="task-activity-heading">
      <h3 id="task-activity-heading" className="text-sm font-medium">
        История активности
      </h3>

      {isLoading && (
        <p className="text-sm text-muted-foreground" data-testid="task-activity-loading">
          Загрузка истории...
        </p>
      )}

      {loadError && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={reload}>
            Повторить
          </Button>
        </div>
      )}

      {!isLoading && !loadError && activity.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="task-activity-empty">
          Пока нет записей активности
        </p>
      )}

      {!isLoading && !loadError && activity.length > 0 && (
        <div className="flex flex-col gap-2">
          <ol className="flex flex-col gap-2" data-testid="task-activity-list">
            {pageItems.map((item) => {
              const described = describeTaskActivity(item, item.actorEmail);
              return (
                <li
                  key={item.id}
                  data-testid="task-activity-item"
                  className="min-w-0 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span data-testid="task-activity-type" className="shrink-0">
                      {described.typeLabel}
                    </span>
                    <time data-testid="task-activity-time" className="shrink-0" dateTime={item.at}>
                      {formatDateTime(item.at)}
                    </time>
                  </div>
                  <p className="mt-1 text-sm break-words whitespace-pre-wrap" data-testid="task-activity-actor">
                    {item.actorEmail}
                  </p>
                  <p className="mt-0.5 text-sm break-words whitespace-pre-wrap" data-testid="task-activity-summary">
                    {described.summary}
                  </p>
                  {described.details ? (
                    <p className="mt-0.5 text-xs break-words text-muted-foreground" data-testid="task-activity-details">
                      {described.details}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            data-testid="task-activity-pagination"
          />
        </div>
      )}
    </section>
  );
}
