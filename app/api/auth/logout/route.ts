import type { NextRequest } from "next/server";
import { jsonOk } from "@/shared/lib/api-response";
import { logout } from "@/features/auth/logout";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  logout(sessionId);

  const response = jsonOk({ success: true }, 200);
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
