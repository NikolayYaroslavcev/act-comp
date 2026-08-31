"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/entities/task/schema";
import { elapsedSinceCreatedMs } from "@/entities/task/model";
import { formatDurationMinutes } from "@/shared/lib/format-duration";

const MS_PER_MINUTE = 60_000;
const TICK_MS = 30_000;

interface TaskAgeCounterProps {
  task: Pick<Task, "createdAt">;
}

/**
 * Separate from TaskTimer: source of truth is createdAt only, never
 * timerStartedAt/timerPausedAt, so it keeps counting regardless of whether
 * the work Timer is running, paused, or was never started, and needs no
 * stored "start" of its own to survive a reload.
 */
export function TaskAgeCounter({ task }: TaskAgeCounterProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const elapsedMinutes = Math.floor(elapsedSinceCreatedMs(task, now) / MS_PER_MINUTE);

  return (
    <p className="text-xs text-muted-foreground" data-testid="task-age-counter">
      В работе с момента создания: {formatDurationMinutes(elapsedMinutes)}
    </p>
  );
}
