import { getSessionsByUserId } from "@/entities/session/repository";
import { toSessionHistoryItem, type SessionHistoryItem } from "@/entities/session/dto";

export function listSessions(userId: string, currentSessionId: string): SessionHistoryItem[] {
  return getSessionsByUserId(userId).map((session) => toSessionHistoryItem(session, currentSessionId));
}
