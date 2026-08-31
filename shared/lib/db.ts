import fs from "node:fs";
import path from "node:path";
import { put, get } from "@vercel/blob";
import data from "@/data.json";
import { databaseSchema, type Database } from "@/entities/database/schema";

export interface DbStore {
  getDb(): Promise<Database>;
  saveDb(db: Database): Promise<void>;
}

function seedDb(): Database {
  return databaseSchema.parse(structuredClone(data));
}

function parsePersistedDb(raw: string): Database {
  const json: unknown = JSON.parse(raw);
  const parsed = databaseSchema.safeParse(json);
  if (parsed.success) {
    return parsed.data;
  }

  const onlyUnknownActivityActions =
    parsed.error.issues.length > 0 &&
    parsed.error.issues.every((issue) => issue.path[0] === "activityLog" && issue.path[2] === "action");

  if (onlyUnknownActivityActions) {
    return json as Database;
  }

  throw parsed.error;
}

/**
 * File-backed application data store, shared over the filesystem instead of
 * a JS module singleton. Next.js bundles Route Handlers, Server Components,
 * and Proxy as separate module graphs (same reasoning as
 * `@/shared/lib/session-store`), so a plain in-memory singleton here ends up
 * as multiple independent copies that never see each other's writes.
 * Reading and writing through disk gives every context one canonical,
 * up-to-date view within the same `next dev`/`next start` process.
 *
 * Writes go to a temp file that's then renamed into place, so a crash
 * mid-write can't leave `filePath` half-written. There's still no locking
 * across concurrent writers (read-modify-write can race and the later write
 * wins) — fine for this app's scale (single local Node process, low
 * concurrency), not a substitute for a real datastore under real load.
 *
 * Only usable on a host with a persistent, shared filesystem (a long-lived
 * Node process) — see `createBlobDbStore` for serverless deployments where
 * every invocation gets its own ephemeral filesystem.
 */
export function createFileDbStore(filePath: string): DbStore {
  function readAll(): Database {
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        const seeded = seedDb();
        writeAll(seeded);
        return seeded;
      }
      throw error;
    }
    return parsePersistedDb(raw);
  }

  function writeAll(db: Database): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(db), "utf-8");
    fs.renameSync(tmpPath, filePath);
  }

  return {
    async getDb() {
      return readAll();
    },
    async saveDb(db) {
      writeAll(db);
    },
  };
}

/**
 * Vercel Blob-backed store, for serverless deployments (Vercel/Netlify)
 * where each function invocation gets its own ephemeral filesystem, so a
 * file on disk can't be shared between requests. Reads/writes the whole
 * database as a single private blob at a fixed pathname — same
 * read-modify-write-the-whole-document semantics as `createFileDbStore`
 * (including the same no-locking, race-on-concurrent-write caveat), just
 * backed by Vercel's object storage instead of the local disk.
 *
 * `useCache: false` on reads is required, not optional: `get()` defaults to
 * serving private blobs from Vercel's CDN cache, which can still return the
 * pre-write version right after `saveDb` writes a change — a read
 * immediately following a mutation would silently see stale data.
 */
export function createBlobDbStore(pathname: string): DbStore {
  async function readAll(): Promise<Database> {
    const result = await get(pathname, { access: "private", useCache: false });

    if (!result || result.statusCode !== 200) {
      const seeded = seedDb();
      await writeAll(seeded);
      return seeded;
    }

    const raw = await new Response(result.stream).text();
    return parsePersistedDb(raw);
  }

  async function writeAll(db: Database): Promise<void> {
    await put(pathname, JSON.stringify(db), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  }

  return {
    getDb: readAll,
    saveDb: writeAll,
  };
}

/** Pure in-memory store, used under Vitest to keep tests fast, isolated per test file, and disk-free. */
function createMemoryDbStore(): DbStore {
  let db: Database | null = null;

  return {
    async getDb() {
      if (!db) {
        db = seedDb();
      }
      return db;
    },
    async saveDb(next) {
      db = next;
    },
  };
}

const DEFAULT_STATE_PATH = path.join(process.cwd(), ".local-state", "db.json");

function createDbStore(): DbStore {
  if (process.env.VITEST) {
    return createMemoryDbStore();
  }
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    return createBlobDbStore("db.json");
  }
  return createFileDbStore(DEFAULT_STATE_PATH);
}

const dbStore: DbStore = createDbStore();

export function getDb(): Promise<Database> {
  return dbStore.getDb();
}

export function saveDb(db: Database): Promise<void> {
  return dbStore.saveDb(db);
}
