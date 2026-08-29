import { revokeAllSessionsForUser } from "@/entities/session/repository";

export function logoutAll(userId: string): void {
  revokeAllSessionsForUser(userId);
}
