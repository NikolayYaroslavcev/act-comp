import { describe, expect, it, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFileDbStore, createBlobDbStore } from "@/shared/lib/db";

// In-memory fake of the Vercel Blob API — mirrors the real service's
// pathname-keyed, whole-file get/put/not-found-returns-null contract closely
// enough to exercise createBlobDbStore's read-modify-write logic without a
// live Blob store (which needs a real Vercel project + token).
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

describe("createFileDbStore", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempFilePath(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "db-store-"));
    tempDirs.push(dir);
    return path.join(dir, "db.json");
  }

  it("seeds from data.json on first read when no file exists yet", async () => {
    const filePath = tempFilePath();
    const store = createFileDbStore(filePath);

    expect((await store.getDb()).tasks.t1).toBeDefined();
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it(
    "makes a task write via one store instance visible to an independently " +
      "constructed instance pointed at the same file (Route Handler vs. Server " +
      "Component being separate module instances in Next.js is exactly this shape)",
    async () => {
      const filePath = tempFilePath();
      const routeHandlerInstance = createFileDbStore(filePath);
      const rscInstance = createFileDbStore(filePath);

      const db = await routeHandlerInstance.getDb();
      db.tasks.t1 = { ...db.tasks.t1, title: "MUTATED-VIA-WRITER" };
      await routeHandlerInstance.saveDb(db);

      expect((await rscInstance.getDb()).tasks.t1.title).toBe("MUTATED-VIA-WRITER");
    }
  );

  it("makes a list write via one store instance visible to an independently constructed instance", async () => {
    const filePath = tempFilePath();
    const writer = createFileDbStore(filePath);
    const reader = createFileDbStore(filePath);

    const db = await writer.getDb();
    db.lists.l1 = { ...db.lists.l1, title: "MUTATED-LIST-TITLE" };
    await writer.saveDb(db);

    expect((await reader.getDb()).lists.l1.title).toBe("MUTATED-LIST-TITLE");
  });

  it("makes a task delete (soft delete) visible to an independently constructed instance", async () => {
    const filePath = tempFilePath();
    const writer = createFileDbStore(filePath);
    const reader = createFileDbStore(filePath);

    expect((await reader.getDb()).tasks.t1.deletedAt).toBeNull();

    const db = await writer.getDb();
    db.tasks.t1 = { ...db.tasks.t1, deletedAt: "2026-08-28T00:00:00.000Z" };
    await writer.saveDb(db);

    expect((await reader.getDb()).tasks.t1.deletedAt).toBe("2026-08-28T00:00:00.000Z");
  });

  it("makes a task restore visible to an independently constructed instance", async () => {
    const filePath = tempFilePath();
    const writer = createFileDbStore(filePath);
    const reader = createFileDbStore(filePath);

    let db = await writer.getDb();
    db.tasks.t1 = { ...db.tasks.t1, deletedAt: "2026-08-28T00:00:00.000Z" };
    await writer.saveDb(db);
    expect((await reader.getDb()).tasks.t1.deletedAt).not.toBeNull();

    db = await writer.getDb();
    db.tasks.t1 = { ...db.tasks.t1, deletedAt: null };
    await writer.saveDb(db);

    expect((await reader.getDb()).tasks.t1.deletedAt).toBeNull();
  });

  it("makes a list share update visible to an independently constructed instance", async () => {
    const filePath = tempFilePath();
    const writer = createFileDbStore(filePath);
    const reader = createFileDbStore(filePath);

    const db = await writer.getDb();
    db.lists.l1 = {
      ...db.lists.l1,
      sharedWith: [...db.lists.l1.sharedWith, { userId: "u3", access: "read" }],
    };
    await writer.saveDb(db);

    expect((await reader.getDb()).lists.l1.sharedWith).toContainEqual({ userId: "u3", access: "read" });
  });

  it("makes a user settings write visible to an independently constructed instance", async () => {
    const filePath = tempFilePath();
    const writer = createFileDbStore(filePath);
    const reader = createFileDbStore(filePath);

    const db = await writer.getDb();
    db.users.u1 = {
      ...db.users.u1,
      settings: { ...db.users.u1.settings, theme: "dark" },
    };
    await writer.saveDb(db);

    expect((await reader.getDb()).users.u1.settings.theme).toBe("dark");
    expect((await reader.getDb()).users.u1.settings.workDayHours).toBe(8);
  });

  it("makes notification acks visible to an independently constructed instance", async () => {
    const filePath = tempFilePath();
    const writer = createFileDbStore(filePath);
    const reader = createFileDbStore(filePath);

    const db = await writer.getDb();
    db.notificationAcks = { u1: ["time_threshold:t1:75"] };
    await writer.saveDb(db);

    expect((await reader.getDb()).notificationAcks.u1).toEqual(["time_threshold:t1:75"]);
  });

  it("still loads the file when activityLog contains an action the current schema enum does not list", async () => {
    const filePath = tempFilePath();
    const writer = createFileDbStore(filePath);
    const db = await writer.getDb();
    const sample = Object.values(db.activityLog)[0];
    expect(sample).toBeDefined();
    db.activityLog["a-unknown-action"] = { ...sample, id: "a-unknown-action", action: "future_action" as never };
    await writer.saveDb(db);

    const reader = createFileDbStore(filePath);
    expect((await reader.getDb()).activityLog["a-unknown-action"]?.action).toBe("future_action");
  });
});

describe("createBlobDbStore", () => {
  afterEach(() => {
    blobFiles.clear();
  });

  it("seeds from data.json on first read when no blob exists yet", async () => {
    const store = createBlobDbStore("db-test-seed.json");

    expect((await store.getDb()).tasks.t1).toBeDefined();
    expect(blobFiles.has("db-test-seed.json")).toBe(true);
  });

  it("makes a write via one store instance visible to an independently constructed instance pointed at the same pathname", async () => {
    const writer = createBlobDbStore("db-test-shared.json");
    const reader = createBlobDbStore("db-test-shared.json");

    const db = await writer.getDb();
    db.tasks.t1 = { ...db.tasks.t1, title: "MUTATED-VIA-BLOB-WRITER" };
    await writer.saveDb(db);

    expect((await reader.getDb()).tasks.t1.title).toBe("MUTATED-VIA-BLOB-WRITER");
  });

  it("keeps separate pathnames isolated from each other", async () => {
    const storeA = createBlobDbStore("db-test-a.json");
    const storeB = createBlobDbStore("db-test-b.json");

    const dbA = await storeA.getDb();
    dbA.tasks.t1 = { ...dbA.tasks.t1, title: "ONLY-IN-A" };
    await storeA.saveDb(dbA);

    expect((await storeB.getDb()).tasks.t1.title).not.toBe("ONLY-IN-A");
  });
});
