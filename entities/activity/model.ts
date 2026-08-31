import type { Activity } from "@/entities/activity/schema";

export function findLatestActivityAmong(entityIds: ReadonlySet<string>, activities: Activity[]): Activity | null {
  let latest: Activity | null = null;
  for (const activity of activities) {
    if (!entityIds.has(activity.entityId)) {
      continue;
    }
    if (!latest || new Date(activity.at).getTime() > new Date(latest.at).getTime()) {
      latest = activity;
    }
  }

  return latest;
}

export function compareActivityNewestFirst(a: Activity, b: Activity): number {
  const byTime = new Date(b.at).getTime() - new Date(a.at).getTime();
  if (byTime !== 0) {
    return byTime;
  }
  return b.id.localeCompare(a.id);
}

const FIELD_LABELS: Record<string, string> = {
  title: "название",
  description: "описание",
  status: "статус",
  priority: "приоритет",
  category: "категорию",
  tags: "теги",
  deadline: "дедлайн",
  estimatedMin: "оценку времени",
  dependsOn: "зависимости",
  parentId: "родительскую задачу",
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  created: "Создание",
  updated: "Изменение",
  status_changed: "Статус",
  deleted: "Удаление",
  restored: "Восстановление",
  commented: "Комментарий",
  shared: "Доступ",
  duplicated: "Клонирование",
  time_extended: "Продление",
  rolled_back: "Откат",
  timer_started: "Таймер",
  timer_paused: "Таймер",
  timer_resumed: "Таймер",
  timer_stopped: "Таймер",
  attachment_added: "Вложение",
  attachment_deleted: "Вложение",
};

function formatActivityValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "пусто";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "пусто" : value.map((item) => formatActivityValue(item)).join(", ");
  }
  return String(value);
}

export function describeTaskActivity(
  activity: Activity,
  actorEmail: string,
): { typeLabel: string; summary: string; details: string | null } {
  const typeLabel = ACTION_TYPE_LABELS[activity.action] ?? activity.action;
  const field = activity.metadata?.field;
  const hasDiff = activity.metadata !== undefined && "old" in activity.metadata && "new" in activity.metadata;
  const diff =
    hasDiff && field
      ? `${formatActivityValue(activity.metadata?.old)} → ${formatActivityValue(activity.metadata?.new)}`
      : null;

  switch (activity.action) {
    case "created":
      return { typeLabel, summary: `${actorEmail} создал задачу`, details: null };
    case "status_changed":
      return {
        typeLabel,
        summary: diff ? `${actorEmail} изменил статус: ${diff}` : `${actorEmail} изменил статус`,
        details: diff,
      };
    case "updated": {
      const fieldLabel = field ? (FIELD_LABELS[field] ?? field) : "поле";
      return {
        typeLabel,
        summary: diff ? `${actorEmail} изменил ${fieldLabel}: ${diff}` : `${actorEmail} изменил задачу`,
        details: diff,
      };
    }
    case "deleted":
      return { typeLabel, summary: `${actorEmail} удалил задачу`, details: null };
    case "restored":
      return { typeLabel, summary: `${actorEmail} восстановил задачу`, details: null };
    case "commented":
      return { typeLabel, summary: `${actorEmail} добавил комментарий`, details: null };
    case "duplicated":
      return { typeLabel, summary: `${actorEmail} клонировал задачу`, details: null };
    case "rolled_back":
      return { typeLabel, summary: `${actorEmail} откатил задачу к предыдущей версии`, details: null };
    case "timer_started":
      return { typeLabel, summary: `${actorEmail} запустил таймер`, details: null };
    case "timer_paused":
      return { typeLabel, summary: `${actorEmail} поставил таймер на паузу`, details: null };
    case "timer_resumed":
      return { typeLabel, summary: `${actorEmail} возобновил таймер`, details: null };
    case "timer_stopped":
      return { typeLabel, summary: `${actorEmail} остановил таймер`, details: null };
    case "attachment_added":
      return {
        typeLabel,
        summary: activity.metadata?.filename
          ? `${actorEmail} добавил файл «${activity.metadata.filename}»`
          : `${actorEmail} добавил файл`,
        details: null,
      };
    case "attachment_deleted":
      return {
        typeLabel,
        summary: activity.metadata?.filename
          ? `${actorEmail} удалил файл «${activity.metadata.filename}»`
          : `${actorEmail} удалил файл`,
        details: null,
      };
    default:
      return { typeLabel, summary: `${actorEmail} выполнил действие`, details: null };
  }
}
