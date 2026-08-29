import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { restoreList } from "@/features/list/restore-list";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const result = restoreList(auth.user.id, id);
  switch (result.status) {
    case "not_found":
      return jsonError(404, "List not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to restore this list");
    case "expired":
      return jsonError(409, "The 30-day restore window for this list has expired");
    case "ok":
      return jsonOk(result.list);
  }
}
