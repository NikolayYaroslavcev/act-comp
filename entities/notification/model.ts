import type { TaskList } from "@/entities/list/schema";
import type { Task } from "@/entities/task/schema";
import type { NotificationSettings } from "@/entities/user/schema";

export const TIME_THRESHOLDS = [75, 90, 100] as const;
export type TimeThreshold = (typeof TIME_THRESHOLDS)[number];

export const DEADLINE_REMINDER_MINUTES = [15, 10, 5] as const;
export type DeadlineReminderMinutes = (typeof DEADLINE_REMINDER_MINUTES)[number];

export type NotificationKind = "time_threshold" | "deadline_reminder";

export interface DueNotification {
  key: string;
  kind: NotificationKind;
  entityType: "task" | "list";
  entityId: string;
  threshold: TimeThreshold | DeadlineReminderMinutes;
  title: string;
  body: string;
}

const MS_PER_MINUTE = 60_000;

/**
 * Elapsed / estimated time thresholds. `elapsedMin` is the current spent
 * figure (today: stored `timeSpentMin`; later a work-hours engine can pass
 * a calendar-aware elapsed value through the same argument).
 */
export function getCrossedTimeThresholds(elapsedMin: number, estimatedMin: number): TimeThreshold[] {
  if (!Number.isFinite(elapsedMin) || !Number.isFinite(estimatedMin)) {
    return [];
  }
  if (estimatedMin <= 0 || elapsedMin < 0) {
    return [];
  }

  return TIME_THRESHOLDS.filter((threshold) => elapsedMin * 100 >= estimatedMin * threshold);
}

export function getCrossedDeadlineReminders(nowMs: number, deadlineMs: number): DeadlineReminderMinutes[] {
  if (!Number.isFinite(nowMs) || !Number.isFinite(deadlineMs)) {
    return [];
  }

  const remainingMs = deadlineMs - nowMs;
  if (remainingMs <= 0) {
    return [];
  }

  return DEADLINE_REMINDER_MINUTES.filter((minutes) => remainingMs <= minutes * MS_PER_MINUTE);
}

export function notificationKey(
  kind: NotificationKind,
  entityId: string,
  threshold: TimeThreshold | DeadlineReminderMinutes,
): string {
  return `${kind}:${entityId}:${threshold}`;
}

export function selectUnseenNotifications(
  candidates: DueNotification[],
  seenKeys: ReadonlySet<string>,
): DueNotification[] {
  const emitted = new Set<string>();
  const result: DueNotification[] = [];

  for (const candidate of candidates) {
    if (seenKeys.has(candidate.key) || emitted.has(candidate.key)) {
      continue;
    }
    emitted.add(candidate.key);
    result.push(candidate);
  }

  return result;
}

function isOpenTask(task: Task): boolean {
  return task.deletedAt === null && task.status !== "done";
}

function listHasOpenWork(list: TaskList, tasks: Task[]): boolean {
  const belonging = tasks.filter((task) => task.listId === list.id && task.deletedAt === null);
  if (belonging.length === 0) {
    return true;
  }
  return belonging.some((task) => task.status !== "done");
}

function thresholdNotifications(task: Task): DueNotification[] {
  return getCrossedTimeThresholds(task.timeSpentMin, task.estimatedMin).map((threshold) => ({
    key: notificationKey("time_threshold", task.id, threshold),
    kind: "time_threshold",
    entityType: "task",
    entityId: task.id,
    threshold,
    title: `${task.code}: потрачено ${threshold}% времени`,
    body: `По задаче «${task.title}» использовано ${threshold}% оценки.`,
  }));
}

function deadlineNotifications(list: TaskList, nowMs: number): DueNotification[] {
  if (list.deadline === null) {
    return [];
  }

  const deadlineMs = Date.parse(list.deadline);
  return getCrossedDeadlineReminders(nowMs, deadlineMs).map((minutes) => ({
    key: notificationKey("deadline_reminder", list.id, minutes),
    kind: "deadline_reminder",
    entityType: "list",
    entityId: list.id,
    threshold: minutes,
    title: `Дедлайн списка через ${minutes} мин`,
    body: `До дедлайна списка «${list.title}» осталось ${minutes} минут.`,
  }));
}

export function evaluateNotifications(input: {
  lists: TaskList[];
  tasks: Task[];
  settings: NotificationSettings;
  now: Date;
  seenKeys: ReadonlySet<string>;
}): DueNotification[] {
  const candidates: DueNotification[] = [];
  const nowMs = input.now.getTime();

  if (input.settings.timeThresholdAlerts) {
    for (const task of input.tasks) {
      if (!isOpenTask(task)) {
        continue;
      }
      candidates.push(...thresholdNotifications(task));
    }
  }

  if (input.settings.deadlineReminders) {
    for (const list of input.lists) {
      if (list.deletedAt !== null) {
        continue;
      }
      if (!listHasOpenWork(list, input.tasks)) {
        continue;
      }
      candidates.push(...deadlineNotifications(list, nowMs));
    }
  }

  return selectUnseenNotifications(candidates, input.seenKeys);
}
