import { sessionStore } from "@/shared/lib/session-store";
import type { Session } from "@/entities/session/schema";
import type { CreateSessionInput } from "@/entities/session/requests";

export function createSession(input: CreateSessionInput): Session {
  const session: Session = {
    id: crypto.randomUUID(),
    userId: input.userId,
    ip: input.ip,
    device: input.device,
    createdAt: new Date().toISOString(),
    rememberMe: input.rememberMe,
    revokedAt: null,
  };

  sessionStore.putSession(session);
  return session;
}

export function findSessionById(id: string): Session | undefined {
  return sessionStore.getSession(id);
}

export function revokeSession(id: string): Session | undefined {
  const session = sessionStore.getSession(id);
  if (!session) {
    return undefined;
  }
  if (session.revokedAt !== null) {
    return session;
  }

  const revoked: Session = { ...session, revokedAt: new Date().toISOString() };
  sessionStore.putSession(revoked);
  return revoked;
}

export function revokeSessionForUser(sessionId: string, userId: string): Session | undefined {
  const session = sessionStore.getSession(sessionId);
  if (!session || session.userId !== userId) {
    return undefined;
  }
  if (session.revokedAt !== null) {
    return session;
  }

  const revoked: Session = { ...session, revokedAt: new Date().toISOString() };
  sessionStore.putSession(revoked);
  return revoked;
}

export function getSessionsByUserId(userId: string): Session[] {
  const sessions = sessionStore.getSessionsByUserId(userId);

  return sessions
    .map((session, index) => ({ session, index }))
    .sort((a, b) => {
      const byCreatedAt = b.session.createdAt.localeCompare(a.session.createdAt);
      return byCreatedAt !== 0 ? byCreatedAt : b.index - a.index;
    })
    .map(({ session }) => session);
}

export function revokeAllSessionsForUser(userId: string): Session[] {
  const revokedAt = new Date().toISOString();
  const revoked: Session[] = [];

  for (const session of sessionStore.getSessionsByUserId(userId)) {
    if (session.revokedAt !== null) {
      continue;
    }

    const updated: Session = { ...session, revokedAt };
    sessionStore.putSession(updated);
    revoked.push(updated);
  }

  return revoked;
}
