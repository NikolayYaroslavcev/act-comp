import { describe, expect, it } from "vitest";
import { createSession } from "@/entities/session/repository";
import { deriveSessionDisplayId } from "@/entities/session/dto";
import { listSessions } from "@/features/auth/list-sessions";
import { login } from "@/features/auth/login";

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

describe("listSessions", () => {
  it("records a login as history for that user", async () => {
    const result = await login(
      { email: "admin@example.com", password: "Admin123!", rememberMe: false },
      { userAgent },
    );
    expect(result).not.toBeNull();

    const history = await listSessions(result!.user.id, result!.session.id);
    const entry = history.find((item) => item.id === deriveSessionDisplayId(result!.session.id));

    expect(entry).toMatchObject({
      id: deriveSessionDisplayId(result!.session.id),
      createdAt: result!.session.createdAt,
      ip: result!.session.ip,
      device: result!.session.device,
      isCurrent: true,
      revokedAt: null,
    });
  });

  it("exposes a display id, never the real session id", async () => {
    const result = await login(
      { email: "admin@example.com", password: "Admin123!", rememberMe: false },
      { userAgent },
    );
    expect(result).not.toBeNull();

    const history = await listSessions(result!.user.id, result!.session.id);

    expect(history.map((item) => item.id)).not.toContain(result!.session.id);
  });

  it("returns only sessions belonging to the given user", async () => {
    const own = await createSession({
      userId: "u-list-own",
      ip: "192.0.2.50 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    const other = await createSession({
      userId: "u-list-other",
      ip: "192.0.2.51 (demo)",
      device: "Firefox on Linux",
      rememberMe: false,
    });

    const history = await listSessions("u-list-own", own.id);

    expect(history.map((item) => item.id)).toContain(deriveSessionDisplayId(own.id));
    expect(history.map((item) => item.id)).not.toContain(deriveSessionDisplayId(other.id));
  });

  it("includes multiple sessions of the same user", async () => {
    const first = await createSession({
      userId: "u-list-multi",
      ip: "192.0.2.52 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    const second = await createSession({
      userId: "u-list-multi",
      ip: "192.0.2.53 (demo)",
      device: "Firefox on Linux",
      rememberMe: true,
    });

    const history = await listSessions("u-list-multi", second.id);

    expect(history.map((item) => item.id)).toEqual(
      expect.arrayContaining([deriveSessionDisplayId(first.id), deriveSessionDisplayId(second.id)]),
    );
    expect(history.find((item) => item.id === deriveSessionDisplayId(second.id))?.isCurrent).toBe(true);
    expect(history.find((item) => item.id === deriveSessionDisplayId(first.id))?.isCurrent).toBe(false);
  });

  it("returns an empty list when the user has no sessions", async () => {
    expect(await listSessions("u-list-none", "unused")).toEqual([]);
  });
});
