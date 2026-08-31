import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { createListInputSchema } from "@/entities/list/requests";
import { listLists } from "@/entities/list/repository";
import { selectVisibleLists } from "@/entities/list/model";
import { requireAuth } from "@/features/auth/require-auth";
import { createList } from "@/features/list/create-list";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  return jsonOk(selectVisibleLists(await listLists(), auth.user.id));
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = createListInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  return jsonOk(await createList(auth.user.id, parsed.data), 201);
}
