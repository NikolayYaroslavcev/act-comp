import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { rollbackTaskInputSchema } from "@/entities/task/requests";
import { requireAuth } from "@/features/auth/require-auth";
import { rollbackTaskForUser } from "@/features/task/rollback-task";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body === null) {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = rollbackTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = rollbackTaskForUser(auth.user.id, id, parsed.data.historyIndex);
  switch (result.status) {
    case "not_found":
      return jsonError(404, "Task not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to edit this task");
    case "unknown_version":
      return jsonError(400, "Unknown history version");
    case "invalid_parent":
      return jsonError(400, "Invalid parentId");
    case "invalid_dependsOn":
      return jsonError(400, "Invalid dependsOn");
    case "cycle":
      return jsonError(409, "Update would create a dependency cycle");
    case "blocked":
      return jsonError(422, "Task cannot be completed while an incomplete dependency blocks it");
    case "ok":
      return jsonOk({ task: result.task, cascade: result.cascade });
  }
}
