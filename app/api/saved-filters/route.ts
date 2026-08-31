import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/shared/lib/api-response";
import { requireAuth } from "@/features/auth/require-auth";
import { savedFilterScopeSchema } from "@/entities/saved-filter/schema";
import { taskFilterCriteriaSchema } from "@/entities/saved-filter/query-schema";
import { listFilterCriteriaSchema } from "@/entities/saved-filter/list-query-schema";
import type { FilterCriteriaByScope } from "@/entities/saved-filter/repository";
import { idSchema } from "@/entities/common/schema";
import { listSavedFiltersForUser } from "@/features/saved-filter/list-saved-filters";
import { applyFilterForUser } from "@/features/saved-filter/apply-filter";
import { saveFilterForUser } from "@/features/saved-filter/save-filter";
import { touchSavedFilterForUser } from "@/features/saved-filter/touch-saved-filter";

const applyRequestSchema = z.object({
  action: z.literal("apply"),
  scope: savedFilterScopeSchema.optional().default("tasks"),
  criteria: z.record(z.string(), z.unknown()),
});
const saveRequestSchema = z.object({
  action: z.literal("save"),
  scope: savedFilterScopeSchema.optional().default("tasks"),
  criteria: z.record(z.string(), z.unknown()),
  label: z.string().min(1).max(100).nullable().optional().default(null),
});
const touchRequestSchema = z.object({ action: z.literal("touch"), id: idSchema });
const postBodySchema = z.discriminatedUnion("action", [applyRequestSchema, saveRequestSchema, touchRequestSchema]);

// criteria is validated loosely by postBodySchema and then re-checked here
// against the schema matching `scope` — a single zod union across both
// scopes' criteria shapes would risk zod matching the wrong branch instead
// of enforcing that the criteria actually match the declared scope.
function parseCriteriaForScope(scope: "tasks" | "lists", criteria: unknown) {
  return scope === "lists" ? listFilterCriteriaSchema.safeParse(criteria) : taskFilterCriteriaSchema.safeParse(criteria);
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.authorized) {
    return jsonError(401, "Unauthorized");
  }

  const scopeParam = request.nextUrl.searchParams.get("scope") ?? "tasks";
  const scopeResult = savedFilterScopeSchema.safeParse(scopeParam);
  if (!scopeResult.success) {
    return jsonError(400, "Invalid scope");
  }

  return jsonOk(await listSavedFiltersForUser(auth.user.id, scopeResult.data));
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

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.issues);
  }

  if (parsed.data.action === "touch") {
    const result = await touchSavedFilterForUser(auth.user.id, parsed.data.id);
    if (result.status === "not_found") {
      return jsonError(404, "Saved filter not found");
    }
    return jsonOk(result.filter);
  }

  const criteriaResult = parseCriteriaForScope(parsed.data.scope, parsed.data.criteria);
  if (!criteriaResult.success) {
    return jsonError(400, "Validation failed", criteriaResult.error.issues);
  }
  const criteria = criteriaResult.data as FilterCriteriaByScope;

  const filter =
    parsed.data.action === "apply"
      ? await applyFilterForUser(auth.user.id, parsed.data.scope, criteria)
      : await saveFilterForUser(auth.user.id, parsed.data.scope, criteria, parsed.data.label);

  return jsonOk(filter, 201);
}
