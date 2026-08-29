import { ackNotificationKeys } from "@/entities/notification/repository";
import { findUserById } from "@/entities/user/repository";

export type AckNotificationsOutcome = { status: "not_found" } | { status: "ok"; keys: string[] };

export function ackNotificationsForUser(userId: string, keys: string[]): AckNotificationsOutcome {
  if (!findUserById(userId)) {
    return { status: "not_found" };
  }

  return { status: "ok", keys: ackNotificationKeys(userId, keys) };
}
