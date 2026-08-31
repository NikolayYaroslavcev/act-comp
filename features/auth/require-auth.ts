import type { NextRequest } from "next/server";
import { getCurrentSession } from "@/features/auth/current-session";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import type { Session } from "@/entities/session/schema";
import type { PublicUser } from "@/entities/user/dto";

export type AuthResult =
  | { authorized: true; session: Session; user: PublicUser }
  | { authorized: false };

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const current = await getCurrentSession(sessionId);

  if (!current) {
    return { authorized: false };
  }

  return { authorized: true, session: current.session, user: current.user };
}
