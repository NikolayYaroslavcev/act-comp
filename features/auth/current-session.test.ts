import { describe, expect, it } from "vitest";
import { getCurrentSession } from "@/features/auth/current-session";
import { createSession } from "@/entities/session/repository";

describe("getCurrentSession", () => {
  it("returns null when no session id is provided", () => {
    expect(getCurrentSession(null)).toBeNull();
    expect(getCurrentSession(undefined)).toBeNull();
  });

  it("returns null for an unknown session id", () => {
    expect(getCurrentSession("does-not-exist")).toBeNull();
  });

  it("returns the session and user for a valid session id", () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const result = getCurrentSession(session.id);
    expect(result?.session.id).toBe(session.id);
    expect(result?.user.id).toBe("u1");
    expect(result && "passwordHash" in result.user).toBe(false);
  });
});
