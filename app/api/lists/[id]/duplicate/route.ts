import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { duplicateListInputSchema } from "@/entities/list/requests";
import { requireAuth } from "@/features/auth/require-auth";
import { duplicateList } from "@/features/list/duplicate-list";

type RouteContext = { params: Promise<{ id: string }> };

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

  const parsed = duplicateListInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = await duplicateList(auth.user.id, id, parsed.data);
  switch (result.status) {
    case "not_found":
    case "deleted":
      return jsonError(404, "List not found");
    case "forbidden":
      return jsonError(403, "You do not have permission to duplicate this list");
    case "ok":
      return jsonOk(result.list, 201);
  }
}
