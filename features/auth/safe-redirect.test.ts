import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  DEFAULT_AUTHENTICATED_ROUTE,
  buildLoginRedirectUrl,
  isInternalPath,
  resolvePostLoginRedirect,
} from "@/features/auth/safe-redirect";

describe("isInternalPath", () => {
  it("accepts internal paths, with or without a query string", () => {
    expect(isInternalPath("/dashboard")).toBe(true);
    expect(isInternalPath("/lists/123?tab=done")).toBe(true);
  });

  it("rejects absolute external URLs", () => {
    expect(isInternalPath("https://evil.com")).toBe(false);
    expect(isInternalPath("http://evil.com")).toBe(false);
  });

  it("rejects protocol-relative URLs", () => {
    expect(isInternalPath("//evil.com")).toBe(false);
  });

  it("rejects the backslash protocol-relative variant", () => {
    expect(isInternalPath("/\\evil.com")).toBe(false);
  });

  it("rejects values without a leading slash", () => {
    expect(isInternalPath("dashboard")).toBe(false);
  });
});

describe("buildLoginRedirectUrl", () => {
  it("points at /login and preserves the original internal path and query", () => {
    const request = new NextRequest("http://localhost/lists/123?tab=done");
    const url = buildLoginRedirectUrl(request);

    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("redirect")).toBe("/lists/123?tab=done");
  });

  it("preserves the root path", () => {
    const request = new NextRequest("http://localhost/");
    const url = buildLoginRedirectUrl(request);

    expect(url.searchParams.get("redirect")).toBe("/");
  });
});

describe("resolvePostLoginRedirect", () => {
  it("returns the default authenticated route when no redirect is given", () => {
    expect(resolvePostLoginRedirect(undefined)).toBe(DEFAULT_AUTHENTICATED_ROUTE);
    expect(resolvePostLoginRedirect(null)).toBe(DEFAULT_AUTHENTICATED_ROUTE);
    expect(resolvePostLoginRedirect("")).toBe(DEFAULT_AUTHENTICATED_ROUTE);
  });

  it("returns a valid internal redirect as-is", () => {
    expect(resolvePostLoginRedirect("/lists/123?tab=done")).toBe("/lists/123?tab=done");
  });

  it("falls back to the default route for an external redirect", () => {
    expect(resolvePostLoginRedirect("https://evil.com")).toBe(DEFAULT_AUTHENTICATED_ROUTE);
    expect(resolvePostLoginRedirect("//evil.com")).toBe(DEFAULT_AUTHENTICATED_ROUTE);
  });

  it("falls back to the default route for a malformed redirect", () => {
    expect(resolvePostLoginRedirect("not-a-path")).toBe(DEFAULT_AUTHENTICATED_ROUTE);
    expect(resolvePostLoginRedirect("/\\evil.com")).toBe(DEFAULT_AUTHENTICATED_ROUTE);
  });
});
