import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFileSessionStore } from "@/shared/lib/session-store";
import type { Session } from "@/entities/session/schema";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: crypto.randomUUID(),
    userId: "u1",
    ip: "192.0.2.9 (demo)",
    device: "Chrome on Windows",
    createdAt: new Date().toISOString(),
    rememberMe: false,
    revokedAt: null,
    ...overrides,
  };
}

describe("createFileSessionStore", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempFilePath(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "session-store-"));
    tempDirs.push(dir);
    return path.join(dir, "sessions.json");
  }

  it(
    "makes a session created via one store instance visible to an independently " +
      "constructed instance pointed at the same file (Proxy vs. route handler being " +
      "separate module instances in Next.js is exactly this shape)",
    () => {
      const filePath = tempFilePath();
      const loginRouteInstance = createFileSessionStore(filePath);
      const proxyInstance = createFileSessionStore(filePath);

      const session = makeSession();
      loginRouteInstance.putSession(session);

      expect(proxyInstance.getSession(session.id)).toEqual(session);
    }
  );

  it("makes a revocation from one instance visible to another instance", () => {
    const filePath = tempFilePath();
    const routeInstance = createFileSessionStore(filePath);
    const proxyInstance = createFileSessionStore(filePath);

    const session = makeSession();
    routeInstance.putSession(session);
    expect(proxyInstance.getSession(session.id)?.revokedAt).toBeNull();

    const revoked = { ...session, revokedAt: new Date().toISOString() };
    routeInstance.putSession(revoked);

    expect(proxyInstance.getSession(session.id)?.revokedAt).toBe(revoked.revokedAt);
  });

  it("seeds from data.json on first read when no file exists yet", () => {
    const filePath = tempFilePath();
    const store = createFileSessionStore(filePath);

    expect(store.getSession("s1")).toBeDefined();
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("persists sessions for a given user across independently constructed instances", () => {
    const filePath = tempFilePath();
    const writer = createFileSessionStore(filePath);
    const reader = createFileSessionStore(filePath);

    const a = makeSession({ userId: "u-shared" });
    const b = makeSession({ userId: "u-shared" });
    writer.putSession(a);
    writer.putSession(b);

    const ids = reader.getSessionsByUserId("u-shared").map((s) => s.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });
});
