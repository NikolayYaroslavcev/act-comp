import fs from "node:fs";
import path from "node:path";
import data from "@/data.json";
import { databaseSchema, type Database } from "@/entities/database/schema";

export interface DbStore {
  getDb(): Database;
  saveDb(db: Database): void;
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
    getDb: readAll,
    saveDb: writeAll,
  };
}

/** Pure in-memory store, used under Vitest to keep tests fast, isolated per test file, and disk-free. */
function createMemoryDbStore(): DbStore {
  let db: Database | null = null;

  return {
    getDb() {
      if (!db) {
        db = seedDb();
      }
      return db;
    },
    saveDb(next) {
      db = next;
    },
  };
}

const DEFAULT_STATE_PATH = path.join(process.cwd(), ".local-state", "db.json");

const dbStore: DbStore = process.env.VITEST ? createMemoryDbStore() : createFileDbStore(DEFAULT_STATE_PATH);

export function getDb(): Database {
  return dbStore.getDb();
}

export function saveDb(db: Database): void {
  dbStore.saveDb(db);
}
