import { describe, expect, it } from "vitest";
import {
  createSession,
  findSessionById,
  getSessionsByUserId,
  revokeAllSessionsForUser,
  revokeSession,
  revokeSessionForUser,
} from "@/entities/session/repository";

describe("createSession", () => {
  it("creates a session with the given input and null revokedAt", () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.1 (demo)",
      device: "Chrome on Windows",
      rememberMe: true,
    });

    expect(session.userId).toBe("u1");
    expect(session.ip).toBe("192.0.2.1 (demo)");
    expect(session.device).toBe("Chrome on Windows");
    expect(session.rememberMe).toBe(true);
    expect(session.revokedAt).toBeNull();
    expect(session.id).toBeTruthy();
    expect(session.createdAt).toBeTruthy();
  });

  it("persists the session so it can be found by id", () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.2 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    expect(findSessionById(session.id)).toEqual(session);
  });
});

describe("findSessionById", () => {
  it("returns undefined for an unknown id", () => {
    expect(findSessionById("does-not-exist")).toBeUndefined();
  });
});

describe("revokeSession", () => {
  it("sets revokedAt on an active session", () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.3 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const revoked = revokeSession(session.id);

    expect(revoked?.revokedAt).toBeTruthy();
    expect(findSessionById(session.id)?.revokedAt).toBe(revoked?.revokedAt);
  });

  it("returns undefined for an unknown session id", () => {
    expect(revokeSession("does-not-exist")).toBeUndefined();
  });

  it("does not change revokedAt when the session is already revoked", () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.4 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const firstRevoke = revokeSession(session.id);
    const secondRevoke = revokeSession(session.id);

    expect(secondRevoke?.revokedAt).toBe(firstRevoke?.revokedAt);
  });
});

describe("revokeAllSessionsForUser", () => {
  it("revokes all active sessions for the given user", () => {
    const sessionA = createSession({
      userId: "u-revoke-all",
      ip: "192.0.2.10 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    const sessionB = createSession({
      userId: "u-revoke-all",
      ip: "192.0.2.11 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    revokeAllSessionsForUser("u-revoke-all");

    expect(findSessionById(sessionA.id)?.revokedAt).toBeTruthy();
    expect(findSessionById(sessionB.id)?.revokedAt).toBeTruthy();
  });

  it("does not change an already revoked session's revokedAt", () => {
    const session = createSession({
      userId: "u-revoke-all-2",
      ip: "192.0.2.12 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    const alreadyRevoked = revokeSession(session.id);

    revokeAllSessionsForUser("u-revoke-all-2");

    expect(findSessionById(session.id)?.revokedAt).toBe(alreadyRevoked?.revokedAt);
  });

  it("does not affect sessions belonging to other users", () => {
    const ownSession = createSession({
      userId: "u-revoke-all-3",
      ip: "192.0.2.13 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    const otherSession = createSession({
      userId: "u-other",
      ip: "192.0.2.14 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    revokeAllSessionsForUser("u-revoke-all-3");

    expect(findSessionById(ownSession.id)?.revokedAt).toBeTruthy();
    expect(findSessionById(otherSession.id)?.revokedAt).toBeNull();
  });
});

describe("revokeSessionForUser", () => {
  it("sets revokedAt on an active session owned by the given user", () => {
    const session = createSession({
      userId: "u-revoke-own",
      ip: "192.0.2.50 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const revoked = revokeSessionForUser(session.id, "u-revoke-own");

    expect(revoked?.revokedAt).toBeTruthy();
    expect(findSessionById(session.id)?.revokedAt).toBe(revoked?.revokedAt);
  });

  it("does not change revokedAt when the session is already revoked", () => {
    const session = createSession({
      userId: "u-revoke-own-2",
      ip: "192.0.2.51 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const firstRevoke = revokeSessionForUser(session.id, "u-revoke-own-2");
    const secondRevoke = revokeSessionForUser(session.id, "u-revoke-own-2");

    expect(secondRevoke?.revokedAt).toBe(firstRevoke?.revokedAt);
  });

  it("returns undefined and changes nothing for an unknown session id", () => {
    expect(revokeSessionForUser("does-not-exist", "u-revoke-own-3")).toBeUndefined();
  });

  it("does not revoke a session belonging to another user", () => {
    const session = createSession({
      userId: "u-revoke-owner",
      ip: "192.0.2.52 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const result = revokeSessionForUser(session.id, "u-revoke-attacker");

    expect(result).toBeUndefined();
    expect(findSessionById(session.id)?.revokedAt).toBeNull();
  });
});

describe("getSessionsByUserId", () => {
  it("returns only sessions belonging to the given user", () => {
    const ownSession = createSession({
      userId: "u-list-sessions",
      ip: "192.0.2.30 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    const otherSession = createSession({
      userId: "u-list-sessions-other",
      ip: "192.0.2.31 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    const sessions = getSessionsByUserId("u-list-sessions");

    expect(sessions.map((s) => s.id)).toContain(ownSession.id);
    expect(sessions.map((s) => s.id)).not.toContain(otherSession.id);
  });

  it("includes both active and revoked sessions", () => {
    const active = createSession({
      userId: "u-list-sessions-2",
      ip: "192.0.2.32 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    const revoked = createSession({
      userId: "u-list-sessions-2",
      ip: "192.0.2.33 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });
    revokeSession(revoked.id);

    const sessions = getSessionsByUserId("u-list-sessions-2");

    expect(sessions.find((s) => s.id === active.id)?.revokedAt).toBeNull();
    expect(sessions.find((s) => s.id === revoked.id)?.revokedAt).toBeTruthy();
  });

  it("sorts sessions from newest to oldest, breaking ties by creation order", () => {
    const first = createSession({
      userId: "u-list-sessions-3",
      ip: "192.0.2.34 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    const second = createSession({
      userId: "u-list-sessions-3",
      ip: "192.0.2.35 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });
    const third = createSession({
      userId: "u-list-sessions-3",
      ip: "192.0.2.36 (demo)",
      device: "Safari on macOS",
      rememberMe: false,
    });

    const sessions = getSessionsByUserId("u-list-sessions-3");

    expect(sessions.map((s) => s.id)).toEqual([third.id, second.id, first.id]);
  });

  it("returns an empty array for a user with no sessions", () => {
    expect(getSessionsByUserId("u-list-sessions-none")).toEqual([]);
  });
});
