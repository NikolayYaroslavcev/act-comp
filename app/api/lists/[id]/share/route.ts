import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { shareListInputSchema } from "@/entities/list/requests";
import { requireAuth } from "@/features/auth/require-auth";
import { shareList } from "@/features/list/share-list";

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

  const parsed = shareListInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = await shareList(auth.user.id, id, parsed.data);
  switch (result.status) {
    case "not_found":
    case "deleted":
      return jsonError(404, "List not found");
    case "forbidden":
      return jsonError(403, "Only the owner can manage sharing for this list");
    case "user_not_found":
      return jsonError(400, "Unable to share this list with the specified user");
    case "self_share":
      return jsonError(400, "Cannot share a list with yourself");
    case "ok":
      return jsonOk(result.list);
  }
}
