import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { createTaskInputSchema } from "@/entities/task/requests";
import { requireAuth } from "@/features/auth/require-auth";
import { listVisibleTasks } from "@/features/task/list-tasks";
import { createTaskForUser } from "@/features/task/create-task";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const listId = request.nextUrl.searchParams.get("listId") ?? undefined;
  return jsonOk(listVisibleTasks(auth.user.id, listId));
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = createTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = createTaskForUser(auth.user.id, parsed.data);
  switch (result.status) {
    case "list_not_found":
      return jsonError(404, "List not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to create tasks in this list");
    case "invalid_parent":
      return jsonError(400, "Invalid parentId");
    case "ok":
      return jsonOk(result.task, 201);
  }
}
