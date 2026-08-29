import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { updateListInputSchema } from "@/entities/list/requests";
import { findListById } from "@/entities/list/repository";
import { requireAuth } from "@/features/auth/require-auth";
import { updateList } from "@/features/list/update-list";
import { deleteList } from "@/features/list/delete-list";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const list = findListById(id);
  if (!list) {
    return jsonError(404, "List not found");
  }

  return jsonOk(list);
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

  const parsed = updateListInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = updateList(auth.user.id, id, parsed.data);
  switch (result.status) {
    case "not_found":
    case "deleted":
      return jsonError(404, "List not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to edit this list");
    case "ok":
      return jsonOk(result.list);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const { id } = await params;
  const result = deleteList(auth.user.id, id);
  switch (result.status) {
    case "not_found":
      return jsonError(404, "List not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to delete this list");
    case "ok":
      return jsonOk(result.list);
  }
}
