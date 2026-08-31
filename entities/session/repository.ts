import { sessionStore } from "@/shared/lib/session-store";
import type { Session } from "@/entities/session/schema";
import type { CreateSessionInput } from "@/entities/session/requests";

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const session: Session = {
    id: crypto.randomUUID(),
    userId: input.userId,
    ip: input.ip,
    device: input.device,
    createdAt: new Date().toISOString(),
    rememberMe: input.rememberMe,
    revokedAt: null,
  };

  await sessionStore.putSession(session);
  return session;
}

export async function findSessionById(id: string): Promise<Session | undefined> {
  return sessionStore.getSession(id);
}

export async function revokeSession(id: string): Promise<Session | undefined> {
  const session = await sessionStore.getSession(id);
  if (!session) {
    return undefined;
  }
  if (session.revokedAt !== null) {
    return session;
  }

  const revoked: Session = { ...session, revokedAt: new Date().toISOString() };
  await sessionStore.putSession(revoked);
  return revoked;
}

export async function revokeSessionForUser(sessionId: string, userId: string): Promise<Session | undefined> {
  const session = await sessionStore.getSession(sessionId);
  if (!session || session.userId !== userId) {
    return undefined;
  }
  if (session.revokedAt !== null) {
    return session;
  }

  const revoked: Session = { ...session, revokedAt: new Date().toISOString() };
  await sessionStore.putSession(revoked);
  return revoked;
}

export async function getSessionsByUserId(userId: string): Promise<Session[]> {
  const sessions = await sessionStore.getSessionsByUserId(userId);

  return sessions
    .map((session, index) => ({ session, index }))
    .sort((a, b) => {
      const byCreatedAt = b.session.createdAt.localeCompare(a.session.createdAt);
      return byCreatedAt !== 0 ? byCreatedAt : b.index - a.index;
    })
    .map(({ session }) => session);
}

export async function revokeAllSessionsForUser(userId: string): Promise<Session[]> {
  const revokedAt = new Date().toISOString();
  const revoked: Session[] = [];

  for (const session of await sessionStore.getSessionsByUserId(userId)) {
    if (session.revokedAt !== null) {
      continue;
    }

    const updated: Session = { ...session, revokedAt };
    await sessionStore.putSession(updated);
    revoked.push(updated);
  }

  return revoked;
}
