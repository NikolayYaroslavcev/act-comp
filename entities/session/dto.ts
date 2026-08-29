import type { Session } from "@/entities/session/schema";

export interface SessionHistoryItem {
  id: string;
  ip: string;
  device: string;
  createdAt: string;
  rememberMe: boolean;
  revokedAt: string | null;
  isCurrent: boolean;
}

export function toSessionHistoryItem(session: Session, currentSessionId: string): SessionHistoryItem {
  return {
    id: session.id,
    ip: session.ip,
    device: session.device,
    createdAt: session.createdAt,
    rememberMe: session.rememberMe,
    revokedAt: session.revokedAt,
    isCurrent: session.id === currentSessionId,
  };
}
