import { selectVisibleLists } from "@/entities/list/model";
import { listLists } from "@/entities/list/repository";
import { evaluateNotifications, type DueNotification } from "@/entities/notification/model";
import { listAckedNotificationKeys } from "@/entities/notification/repository";
import { selectVisibleTasks } from "@/entities/task/model";
import { listTasks } from "@/entities/task/repository";
import { findUserById } from "@/entities/user/repository";

export type ListDueNotificationsOutcome =
  | { status: "not_found" }
  | { status: "ok"; notifications: DueNotification[] };

export function listDueNotificationsForUser(userId: string, now: Date = new Date()): ListDueNotificationsOutcome {
  const user = findUserById(userId);
  if (!user) {
    return { status: "not_found" };
  }

  const lists = selectVisibleLists(listLists(), userId);
  const visibleListIds = new Set(lists.map((list) => list.id));
  const tasks = selectVisibleTasks(listTasks(), visibleListIds);

  return {
    status: "ok",
    notifications: evaluateNotifications({
      lists,
      tasks,
      settings: user.settings.notifications,
      now,
      seenKeys: new Set(listAckedNotificationKeys(userId)),
    }),
  };
}
