import { describe, expect, it } from "vitest";
import { logout } from "@/features/auth/logout";
import { createSession, findSessionById } from "@/entities/session/repository";
import { getCurrentSession } from "@/features/auth/current-session";

describe("logout", () => {
  it("revokes an active session", () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.10 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    logout(session.id);

    expect(findSessionById(session.id)?.revokedAt).toBeTruthy();
  });

  it("makes getCurrentSession stop treating the session as active", () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.11 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    logout(session.id);

    expect(getCurrentSession(session.id)).toBeNull();
  });

  it("does nothing when sessionId is null", () => {
    expect(() => logout(null)).not.toThrow();
  });

  it("does nothing when sessionId is undefined", () => {
    expect(() => logout(undefined)).not.toThrow();
  });

  it("does nothing when the session id is unknown", () => {
    expect(() => logout("does-not-exist")).not.toThrow();
  });

  it("is idempotent for an already revoked session", () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.12 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    logout(session.id);
    const revokedAtAfterFirstLogout = findSessionById(session.id)?.revokedAt;

    logout(session.id);

    expect(findSessionById(session.id)?.revokedAt).toBe(revokedAtAfterFirstLogout);
  });
});
