import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { ackNotificationsInputSchema } from "@/entities/notification/schema";
import { requireAuth } from "@/features/auth/require-auth";
import { ackNotificationsForUser } from "@/features/notification/ack-notifications";
import { listDueNotificationsForUser } from "@/features/notification/list-due-notifications";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const result = listDueNotificationsForUser(auth.user.id);
  if (result.status === "not_found") {
    return jsonError(401, "Unauthorized");
  }

  return jsonOk(result.notifications);
}

export async function PATCH(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = ackNotificationsInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = ackNotificationsForUser(auth.user.id, parsed.data.keys);
  if (result.status === "not_found") {
    return jsonError(401, "Unauthorized");
  }

  return jsonOk(result.keys);
}
