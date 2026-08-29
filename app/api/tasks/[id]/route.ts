import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { updateTaskInputSchema } from "@/entities/task/requests";
import { requireAuth } from "@/features/auth/require-auth";
import { deleteTaskForUser } from "@/features/task/delete-task";
import { getVisibleTask } from "@/features/task/get-task";
import { updateTaskForUser } from "@/features/task/update-task";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const result = getVisibleTask(auth.user.id, id);
  if (result.status === "not_found") {
    return jsonError(404, "Task not found");
  }

  return jsonOk(result.task);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body === null) {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = updateTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = updateTaskForUser(auth.user.id, id, parsed.data);
  switch (result.status) {
    case "not_found":
      return jsonError(404, "Task not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to edit this task");
    case "invalid_parent":
      return jsonError(400, "Invalid parentId");
    case "cycle":
      return jsonError(409, "Update would create a dependency cycle");
    case "ok":
      return jsonOk({ task: result.task, cascade: result.cascade });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const result = deleteTaskForUser(auth.user.id, id);
  switch (result.status) {
    case "not_found":
      return jsonError(404, "Task not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to delete this task");
    case "ok":
      return jsonOk(result.task);
  }
}
