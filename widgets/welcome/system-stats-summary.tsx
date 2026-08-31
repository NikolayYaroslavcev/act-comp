import type { SystemStats } from "@/features/dashboard/system-stats";
import { cn } from "@/shared/lib/utils";

interface SystemStatsSummaryProps {
  stats: SystemStats;
  className?: string;
  variant?: "published" | "compact";
}

export function SystemStatsSummary({
  stats,
  className,
  variant = "published",
}: SystemStatsSummaryProps) {
  if (variant === "compact") {
    return (
      <dl className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm", className)}>
        <div className="flex min-w-0 items-baseline gap-1.5">
          <dt className="text-muted-foreground">Пользователей:</dt>
          <dd className="font-medium tabular-nums">{stats.totalUsers}</dd>
        </div>
        <div className="flex min-w-0 items-baseline gap-1.5">
          <dt className="text-muted-foreground">Задач:</dt>
          <dd className="font-medium tabular-nums">{stats.totalTasks}</dd>
        </div>
      </dl>
    );
  }

  return (
    <section
      aria-label="Статистика системы"
      className={cn("w-full min-w-0 border-t border-border pt-5", className)}
    >
      <dl className="grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col-reverse items-center gap-1">
          <dt className="text-xs text-muted-foreground">Пользователей</dt>
          <dd className="text-lg font-medium tabular-nums tracking-tight">{stats.totalUsers}</dd>
        </div>
        <div className="flex min-w-0 flex-col-reverse items-center gap-1">
          <dt className="text-xs text-muted-foreground">Задач</dt>
          <dd className="text-lg font-medium tabular-nums tracking-tight">{stats.totalTasks}</dd>
        </div>
      </dl>
    </section>
  );
}
