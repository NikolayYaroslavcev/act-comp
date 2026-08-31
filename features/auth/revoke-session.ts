import { deriveSessionDisplayId } from "@/entities/session/dto";
import { getSessionsByUserId, revokeSessionForUser } from "@/entities/session/repository";

export interface RevokeSessionResult {
  /** The real session id that was revoked, or null if displaySessionId did not resolve to one of the caller's own sessions. */
  revokedSessionId: string | null;
}

/**
 * `displaySessionId` is the opaque id GET /api/auth/sessions returns
 * (entities/session/dto.ts:deriveSessionDisplayId) — never the real
 * session.id/bearer credential. Resolving it back to a real session is
 * scoped to the caller's own sessions, so it can't be used to probe or
 * revoke another user's session even if their display id were somehow known.
 */
export async function revokeSession(displaySessionId: string, userId: string): Promise<RevokeSessionResult> {
  const match = (await getSessionsByUserId(userId)).find(
    (session) => deriveSessionDisplayId(session.id) === displaySessionId,
  );
  if (!match) {
    return { revokedSessionId: null };
  }

  await revokeSessionForUser(match.id, userId);
  return { revokedSessionId: match.id };
}
