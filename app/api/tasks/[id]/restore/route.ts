import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { restoreTaskForUser } from "@/features/task/restore-task";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const result = await restoreTaskForUser(auth.user.id, id);
  switch (result.status) {
    case "not_found":
      return jsonError(404, "Task not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to restore this task");
    case "expired":
      return jsonError(409, "The 30-day restore window for this task has expired");
    case "ok":
      return jsonOk(result.task);
  }
}
