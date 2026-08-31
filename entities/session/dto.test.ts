import { describe, expect, it } from "vitest";
import { deriveSessionDisplayId, toSessionHistoryItem } from "./dto";
import type { Session } from "./schema";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "u1",
    ip: "192.0.2.1 (demo)",
    device: "Chrome on Windows",
    createdAt: "2026-08-01T00:00:00.000Z",
    rememberMe: false,
    revokedAt: null,
    ...overrides,
  };
}

describe("deriveSessionDisplayId", () => {
  it("never returns the real session id itself", () => {
    const session = makeSession();
    expect(deriveSessionDisplayId(session.id)).not.toBe(session.id);
  });

  it("does not contain the real session id as a substring", () => {
    const session = makeSession();
    expect(deriveSessionDisplayId(session.id)).not.toContain(session.id);
  });

  it("is deterministic — the same session id always derives the same display id", () => {
    const session = makeSession();
    expect(deriveSessionDisplayId(session.id)).toBe(deriveSessionDisplayId(session.id));
  });

  it("gives different sessions different display ids", () => {
    const a = deriveSessionDisplayId("11111111-1111-4111-8111-111111111111");
    const b = deriveSessionDisplayId("22222222-2222-4222-8222-222222222222");
    expect(a).not.toBe(b);
  });
});

describe("toSessionHistoryItem", () => {
  it("exposes a display id instead of the real session id", () => {
    const session = makeSession();
    const item = toSessionHistoryItem(session, session.id);

    expect(item.id).toBe(deriveSessionDisplayId(session.id));
    expect(item.id).not.toBe(session.id);
  });

  it("still marks the current session as current, using the real id internally", () => {
    const session = makeSession({ id: "current-session" });
    const other = makeSession({ id: "other-session" });

    expect(toSessionHistoryItem(session, "current-session").isCurrent).toBe(true);
    expect(toSessionHistoryItem(other, "current-session").isCurrent).toBe(false);
  });

  it("never leaks userId or other sensitive fields", () => {
    const session = makeSession();
    const item = toSessionHistoryItem(session, session.id);

    expect((item as unknown as { userId?: string }).userId).toBeUndefined();
  });
});
