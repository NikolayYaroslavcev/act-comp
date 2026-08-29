import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { timerActionInputSchema } from "@/entities/task/requests";
import { requireAuth } from "@/features/auth/require-auth";
import { controlTaskTimerForUser } from "@/features/task/control-task-timer";

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

  const parsed = timerActionInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = controlTaskTimerForUser(auth.user.id, id, parsed.data.action);
  switch (result.status) {
    case "not_found":
      return jsonError(404, "Task not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to control this task's timer");
    case "completed":
      return jsonError(409, "Task is completed");
    case "invalid_transition":
      return jsonError(409, "Invalid timer transition");
    case "ok":
      return jsonOk(result.task);
  }
}
