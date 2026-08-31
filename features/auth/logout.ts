import { revokeSession } from "@/entities/session/repository";

export async function logout(sessionId: string | null | undefined): Promise<void> {
  if (!sessionId) {
    return;
  }

  await revokeSession(sessionId);
}
