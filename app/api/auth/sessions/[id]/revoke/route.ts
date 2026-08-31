import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { revokeSession } from "@/features/auth/revoke-session";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const { revokedSessionId } = revokeSession(id, auth.user.id);

  const response = jsonOk({ success: true });

  if (revokedSessionId !== null && revokedSessionId === auth.session.id) {
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
