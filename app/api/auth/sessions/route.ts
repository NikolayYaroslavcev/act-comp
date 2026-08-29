import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { listSessions } from "@/features/auth/list-sessions";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const sessions = listSessions(auth.user.id, auth.session.id);
  return jsonOk({ sessions });
}
