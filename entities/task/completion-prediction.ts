import { elapsedMinutes, type TaskHistoryProvider } from "@/entities/task/model";
import { projectWorkingCompletionMs } from "@/entities/task/working-elapsed";
import type { Task } from "@/entities/task/schema";
import { DEFAULT_SETTINGS } from "@/entities/user/schema";

type CompletionPredictionStatus = "done" | "deleted" | "no_data" | "predicted";
type CompletionPredictionBasis = "estimate" | "history";

export interface TaskCompletionPrediction {
  status: CompletionPredictionStatus;
  /** Current known elapsed minutes — elapsedMinutes for open tasks, timeSpentMin for done/deleted. */
  elapsedMin: number;
  predictedDurationMin: number | null;
  remainingMin: number | null;
  predictedCompletionAt: string | null;
  basis: CompletionPredictionBasis | null;
  isPastDeadline: boolean;
}

function resolveEstimate(task: Task): number | null {
  return Number.isFinite(task.estimatedMin) && task.estimatedMin > 0 ? task.estimatedMin : null;
}

function resolveHistoryAverage(signal: ReturnType<TaskHistoryProvider>): number | null {
  if (signal === null) {
    return null;
  }
  return Number.isFinite(signal.averageActualMinutes) ? signal.averageActualMinutes : null;
}

/**
 * Same overrun rule calculatePriority's history boost already uses: history
 * only overrides the estimate when it signals the task will actually run
 * longer than estimated, otherwise the estimate is trusted as-is.
 */
function determineDuration(
  estimate: number | null,
  historyAvg: number | null,
): { minutes: number; basis: CompletionPredictionBasis } | null {
  if (estimate !== null && historyAvg !== null && historyAvg > estimate) {
    return { minutes: historyAvg, basis: "history" };
  }
  if (estimate !== null) {
    return { minutes: estimate, basis: "estimate" };
  }
  if (historyAvg !== null) {
    return { minutes: historyAvg, basis: "history" };
  }
  return null;
}

const emptyPrediction = (
  status: CompletionPredictionStatus,
  elapsedMin: number,
  remainingMin: number | null,
): TaskCompletionPrediction => ({
  status,
  elapsedMin,
  predictedDurationMin: null,
  remainingMin,
  predictedCompletionAt: null,
  basis: null,
  isPastDeadline: false,
});

/**
 * Deterministic completion prediction (master-plan day 16: "предсказание
 * завершения на основе прогресса", heuristic not ML — section 6). Reuses
 * elapsedMinutes (the same calendar-aware engine Timer/Notifications use)
 * for "how far in", and createSimilarTaskHistoryProvider's signal (passed
 * in as historyProvider, same as calculatePriority) plus task.estimatedMin
 * for "how long in total" — no new data source and no second work-hours
 * formula (projectWorkingCompletionMs inverts the existing engine rather
 * than reimplementing it).
 */
export function predictTaskCompletion(
  task: Task,
  historyProvider: TaskHistoryProvider,
  now: Date = new Date(),
  workDayHours: number = DEFAULT_SETTINGS.workDayHours,
): TaskCompletionPrediction {
  if (task.deletedAt !== null) {
    return emptyPrediction("deleted", task.timeSpentMin, null);
  }

  if (task.status === "done") {
    return emptyPrediction("done", task.timeSpentMin, 0);
  }

  const elapsedMin = elapsedMinutes(task, now, workDayHours);
  const duration = determineDuration(resolveEstimate(task), resolveHistoryAverage(historyProvider(task)));

  if (duration === null) {
    return emptyPrediction("no_data", elapsedMin, null);
  }

  const predictedDurationMin = Math.round(duration.minutes);
  const remainingMin = Math.max(0, Math.round(predictedDurationMin - elapsedMin));
  const predictedCompletionAt =
    remainingMin === 0 ? now.toISOString() : new Date(projectWorkingCompletionMs(now, remainingMin, workDayHours)).toISOString();
  const isPastDeadline = task.deadline !== null && new Date(predictedCompletionAt).getTime() > new Date(task.deadline).getTime();

  return {
    status: "predicted",
    elapsedMin,
    predictedDurationMin,
    remainingMin,
    predictedCompletionAt,
    basis: duration.basis,
    isPastDeadline,
  };
}
