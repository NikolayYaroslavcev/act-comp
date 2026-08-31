import { listSavedFilters } from "@/entities/saved-filter/repository";
import { safeParseSavedListFilterQuery } from "@/entities/saved-filter/list-query-schema";
import { safeParseSavedFilterQuery } from "@/entities/saved-filter/query-schema";
import type { SavedFilter, SavedFilterScope } from "@/entities/saved-filter/schema";

export interface SavedFilterGroups {
  recent: SavedFilter[];
  saved: SavedFilter[];
}

function safeParseQueryForScope(scope: SavedFilterScope, filter: SavedFilter): { saved: boolean } | null {
  return scope === "lists" ? safeParseSavedListFilterQuery(filter) : safeParseSavedFilterQuery(filter);
}

export async function listSavedFiltersForUser(userId: string, scope: SavedFilterScope): Promise<SavedFilterGroups> {
  const filters = await listSavedFilters(userId, scope);
  const recent: SavedFilter[] = [];
  const saved: SavedFilter[] = [];

  for (const filter of filters) {
    const query = safeParseQueryForScope(scope, filter);
    if (!query) {
      continue;
    }
    (query.saved ? saved : recent).push(filter);
  }

  return { recent, saved };
}
