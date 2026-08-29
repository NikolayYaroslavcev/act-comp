import type { NextRequest } from "next/server";

const LOGIN_PATH = "/login";
const REDIRECT_PARAM = "redirect";

export const DEFAULT_AUTHENTICATED_ROUTE = "/dashboard";

/**
 * A path is safe to redirect back to only if it stays inside this app.
 * Rejects absolute URLs, protocol-relative URLs (`//evil.com`), and the
 * backslash variant browsers also treat as protocol-relative (`/\evil.com`).
 */
export function isInternalPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
}

export function buildLoginRedirectUrl(request: NextRequest): URL {
  const loginUrl = new URL(LOGIN_PATH, request.url);
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (isInternalPath(target)) {
    loginUrl.searchParams.set(REDIRECT_PARAM, target);
  }

  return loginUrl;
}

/**
 * Resolves where to send the user after a successful login: the requested
 * internal path if it's safe, otherwise the app's default authenticated
 * route. Used both for the post-login client redirect and for bouncing an
 * already-authenticated visitor away from `/login`.
 */
export function resolvePostLoginRedirect(redirectParam: string | null | undefined): string {
  if (redirectParam && isInternalPath(redirectParam)) {
    return redirectParam;
  }

  return DEFAULT_AUTHENTICATED_ROUTE;
}
