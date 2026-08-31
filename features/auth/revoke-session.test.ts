import { describe, expect, it } from "vitest";
import { revokeSession } from "@/features/auth/revoke-session";
import { createSession, findSessionById } from "@/entities/session/repository";
import { deriveSessionDisplayId } from "@/entities/session/dto";
import { getCurrentSession } from "@/features/auth/current-session";

// revokeSession's `id` parameter is the display id shown by GET
// /api/auth/sessions (entities/session/dto.ts), not the real session.id —
// that's the whole point of the fix: the real bearer credential never has
// to travel back from the client for revoke to work.
describe("revokeSession", () => {
  it("revokes an active session owned by the given user", async () => {
    const session = await createSession({
      userId: "u-uc-1",
      ip: "192.0.2.60 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    await revokeSession(deriveSessionDisplayId(session.id), "u-uc-1");

    expect((await findSessionById(session.id))?.revokedAt).toBeTruthy();
  });

  it("makes getCurrentSession stop treating the session as active", async () => {
    const session = await createSession({
      userId: "u-uc-2",
      ip: "192.0.2.61 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    await revokeSession(deriveSessionDisplayId(session.id), "u-uc-2");

    expect(await getCurrentSession(session.id)).toBeNull();
  });

  it("does not revoke a session belonging to another user, even when given that session's own display id", async () => {
    const session = await createSession({
      userId: "u-uc-owner",
      ip: "192.0.2.62 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    await revokeSession(deriveSessionDisplayId(session.id), "u-uc-attacker");

    expect((await findSessionById(session.id))?.revokedAt).toBeNull();
  });

  it("does not throw for an unknown display id", async () => {
    await expect(revokeSession("does-not-exist", "u-uc-3")).resolves.toEqual({ revokedSessionId: null });
  });

  it("does not accept the real session id in place of its display id", async () => {
    const session = await createSession({
      userId: "u-uc-real-id",
      ip: "192.0.2.64 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    await revokeSession(session.id, "u-uc-real-id");

    expect((await findSessionById(session.id))?.revokedAt).toBeNull();
  });

  it("is idempotent for an already revoked session", async () => {
    const session = await createSession({
      userId: "u-uc-4",
      ip: "192.0.2.63 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    await revokeSession(deriveSessionDisplayId(session.id), "u-uc-4");
    const revokedAtAfterFirst = (await findSessionById(session.id))?.revokedAt;

    await revokeSession(deriveSessionDisplayId(session.id), "u-uc-4");

    expect((await findSessionById(session.id))?.revokedAt).toBe(revokedAtAfterFirst);
  });
});
