import { describe, expect, it, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFileSessionStore, createBlobSessionStore } from "@/shared/lib/session-store";
import type { Session } from "@/entities/session/schema";

// In-memory fake of the Vercel Blob API — see shared/lib/db.test.ts for why
// a fake is used instead of the live service.
const blobFiles = new Map<string, string>();

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string, body: string) => {
    blobFiles.set(pathname, body);
    return { url: `https://example.blob.vercel-storage.com/${pathname}` };
  }),
  get: vi.fn(async (pathname: string) => {
    const content = blobFiles.get(pathname);
    if (content === undefined) {
      return null;
    }
    return { statusCode: 200, stream: new Response(content).body, blob: {} };
  }),
}));

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
    async () => {
      const filePath = tempFilePath();
      const loginRouteInstance = createFileSessionStore(filePath);
      const proxyInstance = createFileSessionStore(filePath);

      const session = makeSession();
      await loginRouteInstance.putSession(session);

      expect(await proxyInstance.getSession(session.id)).toEqual(session);
    }
  );

  it("makes a revocation from one instance visible to another instance", async () => {
    const filePath = tempFilePath();
    const routeInstance = createFileSessionStore(filePath);
    const proxyInstance = createFileSessionStore(filePath);

    const session = makeSession();
    await routeInstance.putSession(session);
    expect((await proxyInstance.getSession(session.id))?.revokedAt).toBeNull();

    const revoked = { ...session, revokedAt: new Date().toISOString() };
    await routeInstance.putSession(revoked);

    expect((await proxyInstance.getSession(session.id))?.revokedAt).toBe(revoked.revokedAt);
  });

  it("seeds from data.json on first read when no file exists yet", async () => {
    const filePath = tempFilePath();
    const store = createFileSessionStore(filePath);

    expect(await store.getSession("s1")).toBeDefined();
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("persists sessions for a given user across independently constructed instances", async () => {
    const filePath = tempFilePath();
    const writer = createFileSessionStore(filePath);
    const reader = createFileSessionStore(filePath);

    const a = makeSession({ userId: "u-shared" });
    const b = makeSession({ userId: "u-shared" });
    await writer.putSession(a);
    await writer.putSession(b);

    const ids = (await reader.getSessionsByUserId("u-shared")).map((s) => s.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });
});

describe("createBlobSessionStore", () => {
  afterEach(() => {
    blobFiles.clear();
  });

  it("seeds from data.json on first read when no blob exists yet", async () => {
    const store = createBlobSessionStore("sessions-test-seed.json");

    expect(await store.getSession("s1")).toBeDefined();
    expect(blobFiles.has("sessions-test-seed.json")).toBe(true);
  });

  it("makes a session created via one store instance visible to an independently constructed instance pointed at the same pathname", async () => {
    const loginRouteInstance = createBlobSessionStore("sessions-test-shared.json");
    const proxyInstance = createBlobSessionStore("sessions-test-shared.json");

    const session = makeSession();
    await loginRouteInstance.putSession(session);

    expect(await proxyInstance.getSession(session.id)).toEqual(session);
  });

  it("makes a revocation from one instance visible to another instance", async () => {
    const routeInstance = createBlobSessionStore("sessions-test-revoke.json");
    const proxyInstance = createBlobSessionStore("sessions-test-revoke.json");

    const session = makeSession();
    await routeInstance.putSession(session);
    expect((await proxyInstance.getSession(session.id))?.revokedAt).toBeNull();

    const revoked = { ...session, revokedAt: new Date().toISOString() };
    await routeInstance.putSession(revoked);

    expect((await proxyInstance.getSession(session.id))?.revokedAt).toBe(revoked.revokedAt);
  });
});
