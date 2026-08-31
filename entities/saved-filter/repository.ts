import { getDb, saveDb } from "@/shared/lib/db";
import type { Database } from "@/entities/database/schema";
import type { SavedFilter, SavedFilterScope } from "@/entities/saved-filter/schema";
import {
  areListFilterCriteriaEqual,
  normalizeListFilterCriteria,
  safeParseSavedListFilterQuery,
  type ListFilterCriteria,
} from "@/entities/saved-filter/list-query-schema";
import {
  areTaskFilterCriteriaEqual,
  normalizeTaskFilterCriteria,
  safeParseSavedFilterQuery,
  type TaskFilterCriteria,
} from "@/entities/saved-filter/query-schema";

const RECENT_LIMIT = 5;

export type FilterCriteriaByScope = TaskFilterCriteria | ListFilterCriteria;

// Each scope has its own criteria shape (query-schema.ts for "tasks",
// list-query-schema.ts for "lists") validated by its own zod schema; this is
// the single dispatch point so the rest of the repository stays scope-agnostic.
function safeParseQueryForScope(scope: SavedFilterScope, filter: SavedFilter): { saved: boolean } | null {
  return scope === "lists" ? safeParseSavedListFilterQuery(filter) : safeParseSavedFilterQuery(filter);
}

function normalizeCriteriaForScope(scope: SavedFilterScope, criteria: FilterCriteriaByScope): FilterCriteriaByScope {
  return scope === "lists"
    ? normalizeListFilterCriteria(criteria as ListFilterCriteria)
    : normalizeTaskFilterCriteria(criteria as TaskFilterCriteria);
}

function areCriteriaEqualForScope(
  scope: SavedFilterScope,
  a: FilterCriteriaByScope,
  b: FilterCriteriaByScope,
): boolean {
  return scope === "lists"
    ? areListFilterCriteriaEqual(a as ListFilterCriteria, b as ListFilterCriteria)
    : areTaskFilterCriteriaEqual(a as TaskFilterCriteria, b as TaskFilterCriteria);
}

export function listSavedFilters(userId: string, scope: SavedFilterScope): SavedFilter[] {
  return Object.values(getDb().savedFilters)
    .filter((filter) => filter.userId === userId && filter.scope === scope)
    .filter((filter) => safeParseQueryForScope(scope, filter) !== null)
    .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime());
}

export interface UpsertFilterInput {
  userId: string;
  scope: SavedFilterScope;
  criteria: FilterCriteriaByScope;
  saved: boolean;
  label: string | null;
}

function findEquivalentFilter(
  db: Database,
  input: UpsertFilterInput,
  normalized: FilterCriteriaByScope,
): SavedFilter | undefined {
  return Object.values(db.savedFilters).find((filter) => {
    if (filter.userId !== input.userId || filter.scope !== input.scope) {
      return false;
    }
    const query = safeParseQueryForScope(input.scope, filter);
    if (!query) {
      return false;
    }
    return (
      query.saved === input.saved &&
      areCriteriaEqualForScope(input.scope, query as unknown as FilterCriteriaByScope, normalized)
    );
  });
}

function trimRecentFilters(db: Database, userId: string, scope: SavedFilterScope): void {
  const recent = Object.values(db.savedFilters)
    .filter((filter) => filter.userId === userId && filter.scope === scope)
    .filter((filter) => {
      const query = safeParseQueryForScope(scope, filter);
      return query !== null && !query.saved;
    })
    .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime());

  for (const stale of recent.slice(RECENT_LIMIT)) {
    delete db.savedFilters[stale.id];
  }
}

/**
 * Single upsert path for both "Apply" (saved:false, recent semantics) and
 * "Save" (saved:true, exempt from the recent cap) — see the plan's Global
 * Constraints for why one entity backs both UX concepts. Works for any
 * scope: normalization/equality/parsing are dispatched by input.scope.
 */
export function upsertAppliedFilter(input: UpsertFilterInput, now: Date = new Date()): SavedFilter {
  const db = getDb();
  const normalized = normalizeCriteriaForScope(input.scope, input.criteria);
  const nowIso = now.toISOString();
  const query = { ...normalized, saved: input.saved, label: input.label };

  const existing = findEquivalentFilter(db, input, normalized);
  if (existing) {
    const updated: SavedFilter = { ...existing, query, usedAt: nowIso };
    db.savedFilters[updated.id] = updated;
    saveDb(db);
    return updated;
  }

  const created: SavedFilter = {
    id: crypto.randomUUID(),
    userId: input.userId,
    scope: input.scope,
    query,
    usedAt: nowIso,
  };
  db.savedFilters[created.id] = created;

  if (!input.saved) {
    trimRecentFilters(db, input.userId, input.scope);
  }

  saveDb(db);
  return created;
}

export type DeleteSavedFilterOutcome = { status: "not_found" } | { status: "ok" };

export function deleteSavedFilter(userId: string, id: string): DeleteSavedFilterOutcome {
  const db = getDb();
  const existing = db.savedFilters[id];
  if (!existing || existing.userId !== userId) {
    return { status: "not_found" };
  }

  delete db.savedFilters[id];
  saveDb(db);
  return { status: "ok" };
}

export type TouchSavedFilterOutcome = { status: "not_found" } | { status: "ok"; filter: SavedFilter };

/**
 * Direct update-by-id for the "Apply from the Saved/Recent panel" path — bumps
 * usedAt on the exact record the caller already identified. Unlike
 * upsertAppliedFilter, this never searches for an equivalent record and never
 * creates one, so it cannot produce a duplicate and never interacts with
 * trimRecentFilters (touching only makes a record fresher, i.e. less likely
 * to be evicted).
 */
export function touchSavedFilter(userId: string, id: string, now: Date = new Date()): TouchSavedFilterOutcome {
  const db = getDb();
  const existing = db.savedFilters[id];
  if (!existing || existing.userId !== userId) {
    return { status: "not_found" };
  }

  const updated: SavedFilter = { ...existing, usedAt: now.toISOString() };
  db.savedFilters[id] = updated;
  saveDb(db);
  return { status: "ok", filter: updated };
}
