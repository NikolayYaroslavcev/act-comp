import { revokeSession } from "@/entities/session/repository";

export function logout(sessionId: string | null | undefined): void {
  if (!sessionId) {
    return;
  }

  revokeSession(sessionId);
}
