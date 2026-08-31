import type { NextRequest } from "next/server";
import { isoDateTimeSchema } from "@/entities/common/schema";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { getTaskChangeStatusForUser } from "@/features/task/get-task-change-status";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const since = isoDateTimeSchema.safeParse(request.nextUrl.searchParams.get("since"));
  if (!since.success) {
    return jsonError(400, "Missing or invalid `since` parameter", since.error.issues);
  }

  const { id } = await params;
  const result = await getTaskChangeStatusForUser(auth.user.id, id, since.data);
  if (result.status === "not_found") {
    return jsonError(404, "Task not found");
  }

  return jsonOk(result.changeStatus);
}
