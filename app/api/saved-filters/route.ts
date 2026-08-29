import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { savedFilterScopeSchema } from "@/entities/saved-filter/schema";
import { taskFilterCriteriaSchema } from "@/entities/saved-filter/query-schema";
import { idSchema } from "@/entities/common/schema";
import { listSavedFiltersForUser } from "@/features/saved-filter/list-saved-filters";
import { applyFilterForUser } from "@/features/saved-filter/apply-filter";
import { saveFilterForUser } from "@/features/saved-filter/save-filter";
import { touchSavedFilterForUser } from "@/features/saved-filter/touch-saved-filter";

const applyRequestSchema = z.object({ action: z.literal("apply"), criteria: taskFilterCriteriaSchema });
const saveRequestSchema = z.object({
  action: z.literal("save"),
  criteria: taskFilterCriteriaSchema,
  label: z.string().min(1).max(100).nullable().optional().default(null),
});
const touchRequestSchema = z.object({ action: z.literal("touch"), id: idSchema });
const postBodySchema = z.discriminatedUnion("action", [applyRequestSchema, saveRequestSchema, touchRequestSchema]);

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const scopeParam = request.nextUrl.searchParams.get("scope") ?? "tasks";
  const scopeResult = savedFilterScopeSchema.safeParse(scopeParam);
  if (!scopeResult.success) {
    return jsonError(400, "Invalid scope");
  }
  if (scopeResult.data === "lists") {
    return jsonError(400, "Scope 'lists' is not supported yet");
  }

  return jsonOk(listSavedFiltersForUser(auth.user.id, scopeResult.data));
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

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  if (parsed.data.action === "touch") {
    const result = touchSavedFilterForUser(auth.user.id, parsed.data.id);
    if (result.status === "not_found") {
      return jsonError(404, "Saved filter not found");
    }
    return jsonOk(result.filter);
  }

  const filter =
    parsed.data.action === "apply"
      ? applyFilterForUser(auth.user.id, parsed.data.criteria)
      : saveFilterForUser(auth.user.id, parsed.data.criteria, parsed.data.label);

  return jsonOk(filter, 201);
}
