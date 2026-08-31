import { getSessionsByUserId } from "@/entities/session/repository";
import { toSessionHistoryItem, type SessionHistoryItem } from "@/entities/session/dto";

export async function listSessions(userId: string, currentSessionId: string): Promise<SessionHistoryItem[]> {
  return (await getSessionsByUserId(userId)).map((session) => toSessionHistoryItem(session, currentSessionId));
}
