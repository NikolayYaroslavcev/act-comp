import { findUserById } from "@/entities/user/repository";
import type { Settings } from "@/entities/user/schema";

export type GetSettingsOutcome = { status: "not_found" } | { status: "ok"; settings: Settings };

export function getSettingsForUser(userId: string): GetSettingsOutcome {
  const user = findUserById(userId);
  if (!user) {
    return { status: "not_found" };
  }
  return { status: "ok", settings: user.settings };
}
