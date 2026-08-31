import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createFileAttachmentBlobStore,
  createMemoryAttachmentBlobStore,
} from "@/entities/attachment/storage";

describe("createFileAttachmentBlobStore", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempBaseDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attachment-store-"));
    tempDirs.push(dir);
    return dir;
  }

  it("returns undefined for bytes that were never written", () => {
    const store = createFileAttachmentBlobStore(tempBaseDir());
    expect(store.read("t1", "a1")).toBeUndefined();
  });

  it("reads back exactly the bytes that were written, creating directories as needed", () => {
    const baseDir = tempBaseDir();
    const store = createFileAttachmentBlobStore(baseDir);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);

    store.write("t1", "a1", bytes);

    expect(store.read("t1", "a1")).toEqual(bytes);
    expect(fs.existsSync(path.join(baseDir, "t1", "a1"))).toBe(true);
  });

  it("keeps attachments for different tasks isolated even with the same attachment id", () => {
    const store = createFileAttachmentBlobStore(tempBaseDir());
    store.write("t1", "a1", new Uint8Array([1]));
    store.write("t2", "a1", new Uint8Array([2]));

    expect(store.read("t1", "a1")).toEqual(new Uint8Array([1]));
    expect(store.read("t2", "a1")).toEqual(new Uint8Array([2]));
  });

  it("removes the file so a later read returns undefined again", () => {
    const store = createFileAttachmentBlobStore(tempBaseDir());
    store.write("t1", "a1", new Uint8Array([1, 2, 3]));

    store.remove("t1", "a1");

    expect(store.read("t1", "a1")).toBeUndefined();
  });

  it("does not throw when removing bytes that were never written", () => {
    const store = createFileAttachmentBlobStore(tempBaseDir());
    expect(() => store.remove("t1", "does-not-exist")).not.toThrow();
  });

  it("makes a write via one store instance visible to an independently constructed instance pointed at the same directory", () => {
    const baseDir = tempBaseDir();
    const writer = createFileAttachmentBlobStore(baseDir);
    const reader = createFileAttachmentBlobStore(baseDir);

    writer.write("t1", "a1", new Uint8Array([9, 9, 9]));

    expect(reader.read("t1", "a1")).toEqual(new Uint8Array([9, 9, 9]));
  });
});

describe("createMemoryAttachmentBlobStore", () => {
  it("reads back exactly the bytes that were written", () => {
    const store = createMemoryAttachmentBlobStore();
    const bytes = new Uint8Array([7, 8, 9]);

    store.write("t1", "a1", bytes);

    expect(store.read("t1", "a1")).toEqual(bytes);
  });

  it("returns undefined for bytes that were never written", () => {
    expect(createMemoryAttachmentBlobStore().read("t1", "a1")).toBeUndefined();
  });

  it("removes bytes so a later read returns undefined", () => {
    const store = createMemoryAttachmentBlobStore();
    store.write("t1", "a1", new Uint8Array([1]));

    store.remove("t1", "a1");

    expect(store.read("t1", "a1")).toBeUndefined();
  });
});
