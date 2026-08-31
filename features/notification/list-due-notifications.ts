import { listActivityForUser } from "@/entities/activity/repository";
import { selectVisibleLists } from "@/entities/list/model";
import { listLists } from "@/entities/list/repository";
import {
  evaluateNotifications,
  type DueNotification,
  type WorkDayHoursChangeEvent,
} from "@/entities/notification/model";
import { listAckedNotificationKeys } from "@/entities/notification/repository";
import { selectVisibleTasks } from "@/entities/task/model";
import { listTasks } from "@/entities/task/repository";
import { findUserById } from "@/entities/user/repository";

async function listWorkDayHoursChanges(userId: string): Promise<WorkDayHoursChangeEvent[]> {
  return (await listActivityForUser(userId))
    .filter((activity) => activity.action === "work_day_hours_changed")
    .map((activity) => ({
      id: activity.id,
      previousHours: Number(activity.metadata?.old),
      newHours: Number(activity.metadata?.new),
    }));
}

export type ListDueNotificationsOutcome =
  | { status: "not_found" }
  | { status: "ok"; notifications: DueNotification[] };

export async function listDueNotificationsForUser(userId: string, now: Date = new Date()): Promise<ListDueNotificationsOutcome> {
  const user = await findUserById(userId);
  if (!user) {
    return { status: "not_found" };
  }

  const lists = selectVisibleLists(await listLists(), userId);
  const visibleListIds = new Set(lists.map((list) => list.id));
  const tasks = selectVisibleTasks(await listTasks(), visibleListIds);

  return {
    status: "ok",
    notifications: evaluateNotifications({
      lists,
      tasks,
      settings: user.settings.notifications,
      now,
      seenKeys: new Set(await listAckedNotificationKeys(userId)),
      workDayHours: user.settings.workDayHours,
      workDayHoursChanges: await listWorkDayHoursChanges(userId),
    }),
  };
}
