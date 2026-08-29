import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFileDbStore } from "@/shared/lib/db";

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

  it("seeds from data.json on first read when no file exists yet", () => {
    const filePath = tempFilePath();
    const store = createFileDbStore(filePath);

    expect(store.getDb().tasks.t1).toBeDefined();
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it(
    "makes a task write via one store instance visible to an independently " +
      "constructed instance pointed at the same file (Route Handler vs. Server " +
      "Component being separate module instances in Next.js is exactly this shape)",
    () => {
      const filePath = tempFilePath();
      const routeHandlerInstance = createFileDbStore(filePath);
      const rscInstance = createFileDbStore(filePath);

      const db = routeHandlerInstance.getDb();
      db.tasks.t1 = { ...db.tasks.t1, title: "MUTATED-VIA-WRITER" };
      routeHandlerInstance.saveDb(db);

      expect(rscInstance.getDb().tasks.t1.title).toBe("MUTATED-VIA-WRITER");
    }
  );

  it("makes a list write via one store instance visible to an independently constructed instance", () => {
    const filePath = tempFilePath();
    const writer = createFileDbStore(filePath);
    const reader = createFileDbStore(filePath);

    const db = writer.getDb();
    db.lists.l1 = { ...db.lists.l1, title: "MUTATED-LIST-TITLE" };
    writer.saveDb(db);

    expect(reader.getDb().lists.l1.title).toBe("MUTATED-LIST-TITLE");
  });

  it("makes a task delete (soft delete) visible to an independently constructed instance", () => {
    const filePath = tempFilePath();
    const writer = createFileDbStore(filePath);
    const reader = createFileDbStore(filePath);

    expect(reader.getDb().tasks.t1.deletedAt).toBeNull();

    const db = writer.getDb();
    db.tasks.t1 = { ...db.tasks.t1, deletedAt: "2026-08-28T00:00:00.000Z" };
    writer.saveDb(db);

    expect(reader.getDb().tasks.t1.deletedAt).toBe("2026-08-28T00:00:00.000Z");
  });

  it("makes a task restore visible to an independently constructed instance", () => {
    const filePath = tempFilePath();
    const writer = createFileDbStore(filePath);
    const reader = createFileDbStore(filePath);

    let db = writer.getDb();
    db.tasks.t1 = { ...db.tasks.t1, deletedAt: "2026-08-28T00:00:00.000Z" };
    writer.saveDb(db);
    expect(reader.getDb().tasks.t1.deletedAt).not.toBeNull();

    db = writer.getDb();
    db.tasks.t1 = { ...db.tasks.t1, deletedAt: null };
    writer.saveDb(db);

    expect(reader.getDb().tasks.t1.deletedAt).toBeNull();
  });

  it("makes a list share update visible to an independently constructed instance", () => {
    const filePath = tempFilePath();
    const writer = createFileDbStore(filePath);
    const reader = createFileDbStore(filePath);

    const db = writer.getDb();
    db.lists.l1 = {
      ...db.lists.l1,
      sharedWith: [...db.lists.l1.sharedWith, { userId: "u3", access: "read" }],
    };
    writer.saveDb(db);

    expect(reader.getDb().lists.l1.sharedWith).toContainEqual({ userId: "u3", access: "read" });
  });
});
