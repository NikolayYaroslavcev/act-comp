import { describe, expect, it } from "vitest";
import { login } from "@/features/auth/login";
import { findSessionById } from "@/entities/session/repository";

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

describe("login", () => {
  it("logs in with the admin demo credentials", async () => {
    const result = await login(
      { email: "admin@example.com", password: "Admin123!", rememberMe: false },
      { userAgent },
    );

    expect(result).not.toBeNull();
    expect(result?.user.email).toBe("admin@example.com");
    expect(result && "passwordHash" in result.user).toBe(false);
  });

  it("logs in with the user demo credentials", async () => {
    const result = await login(
      { email: "user@example.com", password: "User123!", rememberMe: false },
      { userAgent },
    );

    expect(result?.user.email).toBe("user@example.com");
  });

  it("returns null for a wrong password", async () => {
    const result = await login(
      { email: "admin@example.com", password: "wrong-password", rememberMe: false },
      { userAgent },
    );

    expect(result).toBeNull();
  });

  it("returns null for an unknown email", async () => {
    const result = await login(
      { email: "nobody@example.com", password: "Admin123!", rememberMe: false },
      { userAgent },
    );

    expect(result).toBeNull();
  });

  it("creates and persists a session via the repository", async () => {
    const result = await login(
      { email: "admin@example.com", password: "Admin123!", rememberMe: true },
      { userAgent },
    );

    expect(result).not.toBeNull();
    const persisted = await findSessionById(result!.session.id);
    expect(persisted).toEqual(result!.session);
  });

  it("determines device from the User-Agent header", async () => {
    const result = await login(
      { email: "admin@example.com", password: "Admin123!", rememberMe: false },
      { userAgent },
    );

    expect(result?.session.device).toBe("Chrome on Windows");
  });

  it("uses a demo mock IP, independent of the User-Agent", async () => {
    const result = await login(
      { email: "admin@example.com", password: "Admin123!", rememberMe: false },
      { userAgent },
    );

    expect(result?.session.ip).toMatch(/\(demo\)$/);
  });

  it("preserves rememberMe on the created session", async () => {
    const rememberedTrue = await login(
      { email: "admin@example.com", password: "Admin123!", rememberMe: true },
      { userAgent },
    );
    const rememberedFalse = await login(
      { email: "admin@example.com", password: "Admin123!", rememberMe: false },
      { userAgent },
    );

    expect(rememberedTrue?.session.rememberMe).toBe(true);
    expect(rememberedFalse?.session.rememberMe).toBe(false);
  });

  it("sets revokedAt to null on a newly created session", async () => {
    const result = await login(
      { email: "admin@example.com", password: "Admin123!", rememberMe: false },
      { userAgent },
    );

    expect(result?.session.revokedAt).toBeNull();
  });
});
