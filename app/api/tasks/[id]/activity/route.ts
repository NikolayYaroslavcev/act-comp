import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { listTaskActivityForUser } from "@/features/task/list-task-activity";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const result = await listTaskActivityForUser(auth.user.id, id);
  if (result.status === "not_found") {
    return jsonError(404, "Task not found");
  }

  return jsonOk(result.activity);
}
