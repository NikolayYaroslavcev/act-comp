import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentSession } from "@/features/auth/current-session";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { buildLoginRedirectUrl } from "@/features/auth/safe-redirect";

export async function proxy(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (await getCurrentSession(sessionId)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(buildLoginRedirectUrl(request));
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|login|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$|$).*)",
  ],
};
