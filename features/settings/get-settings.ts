import { findUserById } from "@/entities/user/repository";
import type { Settings } from "@/entities/user/schema";

export type GetSettingsOutcome = { status: "not_found" } | { status: "ok"; settings: Settings };

export async function getSettingsForUser(userId: string): Promise<GetSettingsOutcome> {
  const user = await findUserById(userId);
  if (!user) {
    return { status: "not_found" };
  }
  return { status: "ok", settings: user.settings };
}
