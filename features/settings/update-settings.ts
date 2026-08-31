import {
  updateUserSettings,
  type UpdateUserSettingsOutcome,
} from "@/entities/user/repository";
import type { UpdateSettingsInput } from "@/entities/user/requests";

export function updateSettingsForUser(
  userId: string,
  input: UpdateSettingsInput,
): Promise<UpdateUserSettingsOutcome> {
  return updateUserSettings(userId, input);
}
