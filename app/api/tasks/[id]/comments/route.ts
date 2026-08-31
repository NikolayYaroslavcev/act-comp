import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { createCommentInputSchema } from "@/entities/comment/requests";
import { requireAuth } from "@/features/auth/require-auth";
import { listTaskCommentsForUser } from "@/features/comment/list-task-comments";
import { createTaskCommentForUser } from "@/features/comment/create-task-comment";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const result = await listTaskCommentsForUser(auth.user.id, id);
  if (result.status === "not_found") {
    return jsonError(404, "Task not found");
  }

  return jsonOk(result.comments);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body === null) {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = createCommentInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = await createTaskCommentForUser(auth.user.id, id, parsed.data);
  switch (result.status) {
    case "not_found":
      return jsonError(404, "Task not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to comment on this task");
    case "ok":
      return jsonOk(result.comment, 201);
  }
}
