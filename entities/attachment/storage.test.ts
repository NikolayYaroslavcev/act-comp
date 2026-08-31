import { describe, expect, it, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createFileAttachmentBlobStore,
  createMemoryAttachmentBlobStore,
  createBlobAttachmentBlobStore,
} from "@/entities/attachment/storage";

// In-memory fake of the Vercel Blob API — see shared/lib/db.test.ts for why
// a fake is used instead of the live service.
const blobFiles = new Map<string, Buffer>();

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string, body: Buffer) => {
    blobFiles.set(pathname, body);
    return { url: `https://example.blob.vercel-storage.com/${pathname}` };
  }),
  get: vi.fn(async (pathname: string) => {
    const content = blobFiles.get(pathname);
    if (content === undefined) {
      return null;
    }
    return { statusCode: 200, stream: new Response(new Uint8Array(content)).body, blob: {} };
  }),
  del: vi.fn(async (pathname: string) => {
    blobFiles.delete(pathname);
  }),
}));

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

  it("returns undefined for bytes that were never written", async () => {
    const store = createFileAttachmentBlobStore(tempBaseDir());
    expect(await store.read("t1", "a1")).toBeUndefined();
  });

  it("reads back exactly the bytes that were written, creating directories as needed", async () => {
    const baseDir = tempBaseDir();
    const store = createFileAttachmentBlobStore(baseDir);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);

    await store.write("t1", "a1", bytes);

    expect(await store.read("t1", "a1")).toEqual(bytes);
    expect(fs.existsSync(path.join(baseDir, "t1", "a1"))).toBe(true);
  });

  it("keeps attachments for different tasks isolated even with the same attachment id", async () => {
    const store = createFileAttachmentBlobStore(tempBaseDir());
    await store.write("t1", "a1", new Uint8Array([1]));
    await store.write("t2", "a1", new Uint8Array([2]));

    expect(await store.read("t1", "a1")).toEqual(new Uint8Array([1]));
    expect(await store.read("t2", "a1")).toEqual(new Uint8Array([2]));
  });

  it("removes the file so a later read returns undefined again", async () => {
    const store = createFileAttachmentBlobStore(tempBaseDir());
    await store.write("t1", "a1", new Uint8Array([1, 2, 3]));

    await store.remove("t1", "a1");

    expect(await store.read("t1", "a1")).toBeUndefined();
  });

  it("does not throw when removing bytes that were never written", async () => {
    const store = createFileAttachmentBlobStore(tempBaseDir());
    await expect(store.remove("t1", "does-not-exist")).resolves.toBeUndefined();
  });

  it("makes a write via one store instance visible to an independently constructed instance pointed at the same directory", async () => {
    const baseDir = tempBaseDir();
    const writer = createFileAttachmentBlobStore(baseDir);
    const reader = createFileAttachmentBlobStore(baseDir);

    await writer.write("t1", "a1", new Uint8Array([9, 9, 9]));

    expect(await reader.read("t1", "a1")).toEqual(new Uint8Array([9, 9, 9]));
  });
});

describe("createMemoryAttachmentBlobStore", () => {
  it("reads back exactly the bytes that were written", async () => {
    const store = createMemoryAttachmentBlobStore();
    const bytes = new Uint8Array([7, 8, 9]);

    await store.write("t1", "a1", bytes);

    expect(await store.read("t1", "a1")).toEqual(bytes);
  });

  it("returns undefined for bytes that were never written", async () => {
    expect(await createMemoryAttachmentBlobStore().read("t1", "a1")).toBeUndefined();
  });

  it("removes bytes so a later read returns undefined", async () => {
    const store = createMemoryAttachmentBlobStore();
    await store.write("t1", "a1", new Uint8Array([1]));

    await store.remove("t1", "a1");

    expect(await store.read("t1", "a1")).toBeUndefined();
  });
});

describe("createBlobAttachmentBlobStore", () => {
  afterEach(() => {
    blobFiles.clear();
  });

  it("returns undefined for bytes that were never written", async () => {
    const store = createBlobAttachmentBlobStore();
    expect(await store.read("t1", "a1")).toBeUndefined();
  });

  it("reads back exactly the bytes that were written", async () => {
    const store = createBlobAttachmentBlobStore();
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);

    await store.write("t1", "a1", bytes);

    expect(await store.read("t1", "a1")).toEqual(bytes);
  });

  it("keeps attachments for different tasks isolated even with the same attachment id", async () => {
    const store = createBlobAttachmentBlobStore();
    await store.write("t1", "a1", new Uint8Array([1]));
    await store.write("t2", "a1", new Uint8Array([2]));

    expect(await store.read("t1", "a1")).toEqual(new Uint8Array([1]));
    expect(await store.read("t2", "a1")).toEqual(new Uint8Array([2]));
  });

  it("removes the blob so a later read returns undefined again", async () => {
    const store = createBlobAttachmentBlobStore();
    await store.write("t1", "a1", new Uint8Array([1, 2, 3]));

    await store.remove("t1", "a1");

    expect(await store.read("t1", "a1")).toBeUndefined();
  });

  it("makes a write via one store instance visible to an independently constructed instance", async () => {
    const writer = createBlobAttachmentBlobStore();
    const reader = createBlobAttachmentBlobStore();

    await writer.write("t1", "a1", new Uint8Array([9, 9, 9]));

    expect(await reader.read("t1", "a1")).toEqual(new Uint8Array([9, 9, 9]));
  });
});
