import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "@/proxy";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { createSession, revokeSession } from "@/entities/session/repository";

function requestFor(pathname: string, sessionId?: string) {
  return new NextRequest(`http://localhost${pathname}`, {
    headers: sessionId ? { cookie: `${SESSION_COOKIE_NAME}=${sessionId}` } : {},
  });
}

describe("proxy", () => {
  it("lets the request through for an active session", () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });

    const response = proxy(requestFor("/", session.id));

    expect(getRedirectUrl(response)).toBeNull();
  });

  it("redirects to /login when no session cookie is present", () => {
    const response = proxy(requestFor("/"));

    const location = getRedirectUrl(response);
    expect(location).not.toBeNull();
    const url = new URL(location!);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirect")).toBe("/");
  });

  it("redirects to /login for an unknown session id", () => {
    const response = proxy(requestFor("/dashboard", "does-not-exist"));

    const url = new URL(getRedirectUrl(response)!);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirect")).toBe("/dashboard");
  });

  it("redirects to /login for a revoked session", () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    revokeSession(session.id);

    const response = proxy(requestFor("/dashboard", session.id));

    expect(new URL(getRedirectUrl(response)!).pathname).toBe("/login");
  });

  describe("matcher", () => {
    it("does not run on /login", () => {
      expect(unstable_doesMiddlewareMatch({ config, url: "/login" })).toBe(false);
    });

    it("does not run on /api/auth/login", () => {
      expect(unstable_doesMiddlewareMatch({ config, url: "/api/auth/login" })).toBe(false);
    });

    it("does not run on /api/auth/logout", () => {
      expect(unstable_doesMiddlewareMatch({ config, url: "/api/auth/logout" })).toBe(false);
    });

    it("does not run on /api/auth/logout-all", () => {
      expect(unstable_doesMiddlewareMatch({ config, url: "/api/auth/logout-all" })).toBe(false);
    });

    it("does not run on /api/auth/sessions", () => {
      expect(unstable_doesMiddlewareMatch({ config, url: "/api/auth/sessions" })).toBe(false);
    });

    it("does not run on /api/lists (existing requireAuth stays the only guard)", () => {
      expect(unstable_doesMiddlewareMatch({ config, url: "/api/lists" })).toBe(false);
    });

    it("does not run on static assets and internal Next.js routes", () => {
      expect(unstable_doesMiddlewareMatch({ config, url: "/_next/static/chunk.js" })).toBe(false);
      expect(unstable_doesMiddlewareMatch({ config, url: "/_next/image?url=%2Ffoo.png" })).toBe(
        false
      );
      expect(unstable_doesMiddlewareMatch({ config, url: "/favicon.ico" })).toBe(false);
      expect(unstable_doesMiddlewareMatch({ config, url: "/next.svg" })).toBe(false);
    });

    it("runs on application routes", () => {
      expect(unstable_doesMiddlewareMatch({ config, url: "/" })).toBe(true);
      expect(unstable_doesMiddlewareMatch({ config, url: "/dashboard" })).toBe(true);
    });
  });
});
