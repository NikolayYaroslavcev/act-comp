import { revokeSessionForUser } from "@/entities/session/repository";

export function revokeSession(sessionId: string, userId: string): void {
  revokeSessionForUser(sessionId, userId);
}
