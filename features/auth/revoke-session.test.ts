import { describe, expect, it } from "vitest";
import { revokeSession } from "@/features/auth/revoke-session";
import { createSession, findSessionById } from "@/entities/session/repository";
import { getCurrentSession } from "@/features/auth/current-session";

describe("revokeSession", () => {
  it("revokes an active session owned by the given user", () => {
    const session = createSession({
      userId: "u-uc-1",
      ip: "192.0.2.60 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    revokeSession(session.id, "u-uc-1");

    expect(findSessionById(session.id)?.revokedAt).toBeTruthy();
  });

  it("makes getCurrentSession stop treating the session as active", () => {
    const session = createSession({
      userId: "u-uc-2",
      ip: "192.0.2.61 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    revokeSession(session.id, "u-uc-2");

    expect(getCurrentSession(session.id)).toBeNull();
  });

  it("does not revoke a session belonging to another user", () => {
    const session = createSession({
      userId: "u-uc-owner",
      ip: "192.0.2.62 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    revokeSession(session.id, "u-uc-attacker");

    expect(findSessionById(session.id)?.revokedAt).toBeNull();
  });

  it("does not throw for an unknown session id", () => {
    expect(() => revokeSession("does-not-exist", "u-uc-3")).not.toThrow();
  });

  it("is idempotent for an already revoked session", () => {
    const session = createSession({
      userId: "u-uc-4",
      ip: "192.0.2.63 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    revokeSession(session.id, "u-uc-4");
    const revokedAtAfterFirst = findSessionById(session.id)?.revokedAt;

    revokeSession(session.id, "u-uc-4");

    expect(findSessionById(session.id)?.revokedAt).toBe(revokedAtAfterFirst);
  });
});
