import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { updateSettingsInputSchema } from "@/entities/user/requests";
import { requireAuth } from "@/features/auth/require-auth";
import { getSettingsForUser } from "@/features/settings/get-settings";
import { updateSettingsForUser } from "@/features/settings/update-settings";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const result = await getSettingsForUser(auth.user.id);
  if (result.status === "not_found") {
    return jsonError(401, "Unauthorized");
  }

  return jsonOk(result.settings);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = updateSettingsInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  const result = await updateSettingsForUser(auth.user.id, parsed.data);
  if (result.status === "not_found") {
    return jsonError(401, "Unauthorized");
  }

  return jsonOk(result.settings);
}
