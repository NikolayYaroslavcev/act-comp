import { describe, expect, it } from "vitest";
import { createSession, findSessionById } from "@/entities/session/repository";
import { logoutAll } from "@/features/auth/logout-all";
import { getCurrentSession } from "@/features/auth/current-session";

describe("logoutAll", () => {
  it("invalidates every active session of the user", () => {
    const current = createSession({
      userId: "u-logout-all",
      ip: "192.0.2.60 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    const other = createSession({
      userId: "u-logout-all",
      ip: "192.0.2.61 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    logoutAll("u-logout-all");

    expect(findSessionById(current.id)?.revokedAt).toBeTruthy();
    expect(findSessionById(other.id)?.revokedAt).toBeTruthy();
    expect(getCurrentSession(current.id)).toBeNull();
    expect(getCurrentSession(other.id)).toBeNull();
  });

  it("does not affect sessions of another user", () => {
    createSession({
      userId: "u1",
      ip: "192.0.2.62 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    const otherUser = createSession({
      userId: "u2",
      ip: "192.0.2.63 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    logoutAll("u1");

    expect(findSessionById(otherUser.id)?.revokedAt).toBeNull();
    expect(getCurrentSession(otherUser.id)?.session.id).toBe(otherUser.id);
  });

  it("handles a repeated logout-all without changing already revoked timestamps", () => {
    const session = createSession({
      userId: "u-logout-all-repeat",
      ip: "192.0.2.64 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    logoutAll("u-logout-all-repeat");
    const revokedAt = findSessionById(session.id)?.revokedAt;

    logoutAll("u-logout-all-repeat");

    expect(findSessionById(session.id)?.revokedAt).toBe(revokedAt);
  });
});
