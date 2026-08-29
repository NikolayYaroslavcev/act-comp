import { listSavedFilters } from "@/entities/saved-filter/repository";
import { safeParseSavedFilterQuery } from "@/entities/saved-filter/query-schema";
import type { SavedFilter, SavedFilterScope } from "@/entities/saved-filter/schema";

export interface SavedFilterGroups {
  recent: SavedFilter[];
  saved: SavedFilter[];
}

export function listSavedFiltersForUser(userId: string, scope: SavedFilterScope): SavedFilterGroups {
  const filters = listSavedFilters(userId, scope);
  const recent: SavedFilter[] = [];
  const saved: SavedFilter[] = [];

  for (const filter of filters) {
    const query = safeParseSavedFilterQuery(filter);
    if (!query) {
      continue;
    }
    (query.saved ? saved : recent).push(filter);
  }

  return { recent, saved };
}
