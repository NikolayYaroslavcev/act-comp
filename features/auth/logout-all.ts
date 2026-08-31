import { revokeAllSessionsForUser } from "@/entities/session/repository";

export async function logoutAll(userId: string): Promise<void> {
  await revokeAllSessionsForUser(userId);
}
