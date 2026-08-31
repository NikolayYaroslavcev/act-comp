import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { put, get } from "@vercel/blob";
import data from "@/data.json";
import { sessionSchema, type Session } from "@/entities/session/schema";

const sessionsRecordSchema = z.record(z.string(), sessionSchema);
type SessionsRecord = z.infer<typeof sessionsRecordSchema>;

export interface SessionStore {
  getSession(id: string): Promise<Session | undefined>;
  putSession(session: Session): Promise<void>;
  getSessionsByUserId(userId: string): Promise<Session[]>;
}

function seedSessions(): SessionsRecord {
  return sessionsRecordSchema.parse(structuredClone(data.sessions));
}

/**
 * File-backed session store, shared over the filesystem instead of a JS
 * module singleton. Proxy runs as a separate bundle/module instance from
 * route handlers (Next.js explicitly documents this and warns against
 * relying on shared modules/globals between them), so a plain in-memory
 * singleton in each context ends up as two independent copies. Reading and
 * writing through disk gives both contexts one canonical, up-to-date view
 * within the same `next dev`/`next start` process.
 *
 * No locking: fine for this app's scale (single local Node process, low
 * concurrency), not a substitute for a real datastore under real load.
 *
 * Only usable on a host with a persistent, shared filesystem — see
 * `createBlobSessionStore` for serverless deployments.
 */
export function createFileSessionStore(filePath: string): SessionStore {
  function readAll(): SessionsRecord {
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        const seeded = seedSessions();
        writeAll(seeded);
        return seeded;
      }
      throw error;
    }
    return sessionsRecordSchema.parse(JSON.parse(raw));
  }

  function writeAll(sessions: SessionsRecord): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(sessions), "utf-8");
  }

  return {
    async getSession(id) {
      return readAll()[id];
    },
    async putSession(session) {
      const sessions = readAll();
      sessions[session.id] = session;
      writeAll(sessions);
    },
    async getSessionsByUserId(userId) {
      return Object.values(readAll()).filter((session) => session.userId === userId);
    },
  };
}

/**
 * Vercel Blob-backed session store, for serverless deployments where each
 * function invocation gets its own ephemeral filesystem — a session written
 * by the login route wouldn't otherwise be visible to the next request.
 * Same whole-document read-modify-write semantics as `createFileSessionStore`.
 */
export function createBlobSessionStore(pathname: string): SessionStore {
  async function readAll(): Promise<SessionsRecord> {
    const result = await get(pathname, { access: "private" });

    if (!result || result.statusCode !== 200) {
      const seeded = seedSessions();
      await writeAll(seeded);
      return seeded;
    }

    const raw = await new Response(result.stream).text();
    return sessionsRecordSchema.parse(JSON.parse(raw));
  }

  async function writeAll(sessions: SessionsRecord): Promise<void> {
    await put(pathname, JSON.stringify(sessions), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  }

  return {
    async getSession(id) {
      return (await readAll())[id];
    },
    async putSession(session) {
      const sessions = await readAll();
      sessions[session.id] = session;
      await writeAll(sessions);
    },
    async getSessionsByUserId(userId) {
      return Object.values(await readAll()).filter((session) => session.userId === userId);
    },
  };
}

/** Pure in-memory store, used under Vitest to keep tests fast, isolated per test file, and disk-free. */
function createMemorySessionStore(): SessionStore {
  let sessions: SessionsRecord | null = null;

  function ensure(): SessionsRecord {
    if (!sessions) {
      sessions = seedSessions();
    }
    return sessions;
  }

  return {
    async getSession(id) {
      return ensure()[id];
    },
    async putSession(session) {
      ensure()[session.id] = session;
    },
    async getSessionsByUserId(userId) {
      return Object.values(ensure()).filter((session) => session.userId === userId);
    },
  };
}

const DEFAULT_STATE_PATH = path.join(process.cwd(), ".local-state", "sessions.json");

function createSessionStore(): SessionStore {
  if (process.env.VITEST) {
    return createMemorySessionStore();
  }
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    return createBlobSessionStore("sessions.json");
  }
  return createFileSessionStore(DEFAULT_STATE_PATH);
}

export const sessionStore: SessionStore = createSessionStore();
