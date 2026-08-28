import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { deleteSavedFilterForUser } from "@/features/saved-filter/delete-saved-filter";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const result = deleteSavedFilterForUser(auth.user.id, id);
  if (result.status === "not_found") {
    return jsonError(404, "Saved filter not found");
  }

  return jsonOk({ id });
}
