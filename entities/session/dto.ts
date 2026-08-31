import { createHash } from "node:crypto";
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

/**
 * session.id doubles as the bearer credential stored in the session_id
 * cookie (features/auth/current-session.ts resolves it directly via
 * findSessionById) — it must never leave the server in an API response.
 * This derives a stable, one-way display identifier instead: deterministic
 * (same session -> same value every call, so the client can round-trip it
 * for revoke), but never equal to — or usable in place of — the real id,
 * since findSessionById only matches an exact stored session.id and a
 * SHA-256 digest of that id will never collide with it.
 */
export function deriveSessionDisplayId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex").slice(0, 16);
}

export function toSessionHistoryItem(session: Session, currentSessionId: string): SessionHistoryItem {
  return {
    id: deriveSessionDisplayId(session.id),
    ip: session.ip,
    device: session.device,
    createdAt: session.createdAt,
    rememberMe: session.rememberMe,
    revokedAt: session.revokedAt,
    isCurrent: session.id === currentSessionId,
  };
}
