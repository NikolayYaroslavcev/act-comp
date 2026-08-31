import { ackNotificationKeys } from "@/entities/notification/repository";
import { findUserById } from "@/entities/user/repository";
import { listDueNotificationsForUser } from "@/features/notification/list-due-notifications";

export type AckNotificationsOutcome =
  | { status: "not_found" }
  | { status: "invalid_keys" }
  | { status: "ok"; keys: string[] };

export async function ackNotificationsForUser(
  userId: string,
  keys: string[],
  now: Date = new Date(),
): Promise<AckNotificationsOutcome> {
  if (!(await findUserById(userId))) {
    return { status: "not_found" };
  }

  const due = await listDueNotificationsForUser(userId, now);
  if (due.status === "not_found") {
    return { status: "not_found" };
  }

  const allowed = new Set(due.notifications.map((notification) => notification.key));
  if (keys.some((key) => !allowed.has(key))) {
    return { status: "invalid_keys" };
  }

  return { status: "ok", keys: await ackNotificationKeys(userId, keys) };
}
