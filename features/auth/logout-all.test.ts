import { describe, expect, it } from "vitest";
import { createSession, findSessionById } from "@/entities/session/repository";
import { logoutAll } from "@/features/auth/logout-all";
import { getCurrentSession } from "@/features/auth/current-session";

describe("logoutAll", () => {
  it("invalidates every active session of the user", async () => {
    const current = await createSession({
      userId: "u-logout-all",
      ip: "192.0.2.60 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    const other = await createSession({
      userId: "u-logout-all",
      ip: "192.0.2.61 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    await logoutAll("u-logout-all");

    expect((await findSessionById(current.id))?.revokedAt).toBeTruthy();
    expect((await findSessionById(other.id))?.revokedAt).toBeTruthy();
    expect(await getCurrentSession(current.id)).toBeNull();
    expect(await getCurrentSession(other.id)).toBeNull();
  });

  it("does not affect sessions of another user", async () => {
    await createSession({
      userId: "u1",
      ip: "192.0.2.62 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    const otherUser = await createSession({
      userId: "u2",
      ip: "192.0.2.63 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    await logoutAll("u1");

    expect((await findSessionById(otherUser.id))?.revokedAt).toBeNull();
    expect((await getCurrentSession(otherUser.id))?.session.id).toBe(otherUser.id);
  });

  it("handles a repeated logout-all without changing already revoked timestamps", async () => {
    const session = await createSession({
      userId: "u-logout-all-repeat",
      ip: "192.0.2.64 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    await logoutAll("u-logout-all-repeat");
    const revokedAt = (await findSessionById(session.id))?.revokedAt;

    await logoutAll("u-logout-all-repeat");

    expect((await findSessionById(session.id))?.revokedAt).toBe(revokedAt);
  });
});
