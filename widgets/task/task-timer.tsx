"use client";

import { useCallback, useEffect, useState } from "react";
import type { Task } from "@/entities/task/schema";
import type { TimerAction } from "@/entities/task/requests";
import {
  elapsedMinutes,
  elapsedMs,
  estimateProgressPercent,
  formatElapsedClock,
  getTimerCountdownTier,
  getTimerState,
  remainingMs,
  type TimerCountdownTier,
} from "@/entities/task/model";
import { DEFAULT_SETTINGS } from "@/entities/user/schema";
import { useTaskTimer } from "@/features/task/use-task-timer";
import { useTimerInactivityPause } from "@/features/task/use-timer-inactivity-pause";
import { Button } from "@/shared/ui/button";
import { Progress } from "@/shared/ui/progress";
import { cn } from "@/shared/lib/utils";
import { formatDurationMinutes } from "@/shared/lib/format-duration";

const STATE_LABELS = {
  stopped: "Остановлен",
  running: "Идёт",
  paused: "На паузе",
} as const;

const COUNTDOWN_TIER_CLASSNAME: Record<TimerCountdownTier, string> = {
  normal: "",
  warning: "text-warning",
  urgent: "text-destructive",
};

interface TaskTimerProps {
  task: Task;
  canEdit: boolean;
  onTaskUpdated: (task: Task) => void;
  workDayHours?: number;
}

export function TaskTimer({ task, canEdit, onTaskUpdated, workDayHours = DEFAULT_SETTINGS.workDayHours }: TaskTimerProps) {
  const { controlTimer, isPending, error } = useTaskTimer();
  const [, setTick] = useState(0);
  const state = getTimerState(task);
  const blocked = !canEdit || task.status === "done" || task.deletedAt !== null;

  useEffect(() => {
    if (state !== "running") {
      return;
    }
    const id = window.setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(id);
  }, [state, task.id, task.timerStartedAt]);

  const handleAction = useCallback(
    async (action: TimerAction) => {
      if (isPending || blocked) {
        return;
      }
      const updated = await controlTimer(task.id, action);
      if (updated) {
        onTaskUpdated(updated);
      }
    },
    [blocked, controlTimer, isPending, onTaskUpdated, task.id],
  );

  useTimerInactivityPause({
    enabled: state === "running" && !blocked,
    onPause: () => {
      void handleAction("pause");
    },
  });

  const clock = new Date();
  const elapsed = elapsedMs(task, clock, workDayHours);
  const progress = estimateProgressPercent(elapsedMinutes(task, clock, workDayHours), task.estimatedMin);
  const remaining = remainingMs(task, clock, workDayHours);
  const countdownTier = getTimerCountdownTier(task, clock, workDayHours);
  const overrun = remaining !== null && remaining < 0;
  const unavailable =
    task.status === "done"
      ? "Таймер недоступен для завершённой задачи"
      : task.deletedAt !== null
        ? "Таймер недоступен для удалённой задачи"
        : null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-3" data-testid="task-timer">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs text-muted-foreground">{remaining !== null ? "Осталось времени" : "Таймер"}</p>
          {remaining !== null ? (
            <>
              <p
                className={cn("font-mono text-2xl tabular-nums", countdownTier && COUNTDOWN_TIER_CLASSNAME[countdownTier])}
                data-testid="task-timer-remaining"
                aria-label={
                  overrun
                    ? `Просрочено на ${formatElapsedClock(Math.abs(remaining))}`
                    : `Осталось ${formatElapsedClock(remaining)}`
                }
              >
                {formatElapsedClock(Math.abs(remaining))}
              </p>
              {overrun && <p className="text-xs font-medium text-destructive">Просрочено</p>}
            </>
          ) : (
            <p
              className="font-mono text-2xl tabular-nums"
              data-testid="task-timer-elapsed"
              aria-label={`Прошло ${formatElapsedClock(elapsed)}`}
            >
              {formatElapsedClock(elapsed)}
            </p>
          )}
        </div>
        <p
          className="text-sm font-medium"
          data-testid="task-timer-state"
          aria-live="polite"
        >
          {STATE_LABELS[state]}
        </p>
      </div>

      {task.estimatedMin > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid="task-timer-estimate">Оценка: {formatDurationMinutes(task.estimatedMin)}</span>
            {progress !== null && (
              <span className="tabular-nums" data-testid="task-timer-progress">
                {progress}%
              </span>
            )}
          </div>
          {progress !== null && <Progress value={progress} aria-label="Прогресс относительно оценки" />}
        </div>
      )}

      {unavailable && (
        <p className="text-xs text-muted-foreground" data-testid="task-timer-unavailable">
          {unavailable}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={blocked || isPending || state !== "stopped"}
          aria-label="Запустить таймер"
          data-testid="task-timer-start"
          onClick={() => void handleAction("start")}
        >
          Старт
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={blocked || isPending || state !== "running"}
          aria-label="Пауза"
          data-testid="task-timer-pause"
          onClick={() => void handleAction("pause")}
        >
          Пауза
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={blocked || isPending || state !== "paused"}
          aria-label="Продолжить таймер"
          data-testid="task-timer-resume"
          onClick={() => void handleAction("resume")}
        >
          Продолжить
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={blocked || isPending || state === "stopped"}
          aria-label="Остановить таймер"
          data-testid="task-timer-stop"
          onClick={() => void handleAction("stop")}
        >
          Стоп
        </Button>
      </div>
    </section>
  );
}
