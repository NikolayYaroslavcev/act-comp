import { describe, expect, it } from "vitest";
import { logout } from "@/features/auth/logout";
import { createSession, findSessionById } from "@/entities/session/repository";
import { getCurrentSession } from "@/features/auth/current-session";

describe("logout", () => {
  it("revokes an active session", async () => {
    const session = await createSession({
      userId: "u1",
      ip: "192.0.2.10 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    await logout(session.id);

    expect((await findSessionById(session.id))?.revokedAt).toBeTruthy();
  });

  it("makes getCurrentSession stop treating the session as active", async () => {
    const session = await createSession({
      userId: "u1",
      ip: "192.0.2.11 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    await logout(session.id);

    expect(await getCurrentSession(session.id)).toBeNull();
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

  it("is idempotent for an already revoked session", async () => {
    const session = await createSession({
      userId: "u1",
      ip: "192.0.2.12 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    await logout(session.id);
    const revokedAtAfterFirstLogout = (await findSessionById(session.id))?.revokedAt;

    await logout(session.id);

    expect((await findSessionById(session.id))?.revokedAt).toBe(revokedAtAfterFirstLogout);
  });
});
