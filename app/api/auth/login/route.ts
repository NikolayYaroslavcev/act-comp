import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { loginInputSchema } from "@/entities/auth/requests";
import { login } from "@/features/auth/login";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";

const REMEMBER_ME_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = loginInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = login(parsed.data, { userAgent: request.headers.get("user-agent") });
  if (!result) {
    return jsonError(401, "Invalid email or password");
  }

  const response = jsonOk(result, 200);
  response.cookies.set(SESSION_COOKIE_NAME, result.session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(parsed.data.rememberMe ? { maxAge: REMEMBER_ME_MAX_AGE_SECONDS } : {}),
  });

  return response;
}
