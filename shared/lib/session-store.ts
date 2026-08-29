import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import data from "@/data.json";
import { sessionSchema, type Session } from "@/entities/session/schema";

const sessionsRecordSchema = z.record(z.string(), sessionSchema);
type SessionsRecord = z.infer<typeof sessionsRecordSchema>;

export interface SessionStore {
  getSession(id: string): Session | undefined;
  putSession(session: Session): void;
  getSessionsByUserId(userId: string): Session[];
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
    getSession(id) {
      return readAll()[id];
    },
    putSession(session) {
      const sessions = readAll();
      sessions[session.id] = session;
      writeAll(sessions);
    },
    getSessionsByUserId(userId) {
      return Object.values(readAll()).filter((session) => session.userId === userId);
    },
  };
}

/** Pure in-memory store, used under Vitest to keep tests fast, isolated per test file, and disk-free. */
export function createMemorySessionStore(): SessionStore {
  let sessions: SessionsRecord | null = null;

  function ensure(): SessionsRecord {
    if (!sessions) {
      sessions = seedSessions();
    }
    return sessions;
  }

  return {
    getSession(id) {
      return ensure()[id];
    },
    putSession(session) {
      ensure()[session.id] = session;
    },
    getSessionsByUserId(userId) {
      return Object.values(ensure()).filter((session) => session.userId === userId);
    },
  };
}

const DEFAULT_STATE_PATH = path.join(process.cwd(), ".local-state", "sessions.json");

export const sessionStore: SessionStore = process.env.VITEST
  ? createMemorySessionStore()
  : createFileSessionStore(DEFAULT_STATE_PATH);
