import { findSessionById } from "@/entities/session/repository";
import { findUserById } from "@/entities/user/repository";
import { toPublicUser, type PublicUser } from "@/entities/user/dto";
import type { Session } from "@/entities/session/schema";

export interface CurrentSession {
  session: Session;
  user: PublicUser;
}

/**
 * Resolves a session id (read from the session cookie by the caller) to its
 * session/user, or null if missing, unknown, or revoked. Used by
 * `requireAuth` to guard protected routes.
 */
export function getCurrentSession(sessionId: string | null | undefined): CurrentSession | null {
  if (!sessionId) {
    return null;
  }

  const session = findSessionById(sessionId);
  if (!session || session.revokedAt !== null) {
    return null;
  }

  const user = findUserById(session.userId);
  if (!user) {
    return null;
  }

  return { session, user: toPublicUser(user) };
}
