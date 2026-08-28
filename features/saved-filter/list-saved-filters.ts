import { listSavedFilters } from "@/entities/saved-filter/repository";
import { parseSavedFilterQuery } from "@/entities/saved-filter/query-schema";
import type { SavedFilter, SavedFilterScope } from "@/entities/saved-filter/schema";

export interface SavedFilterGroups {
  recent: SavedFilter[];
  saved: SavedFilter[];
}

export function listSavedFiltersForUser(userId: string, scope: SavedFilterScope): SavedFilterGroups {
  const filters = listSavedFilters(userId, scope);
  return {
    recent: filters.filter((filter) => !parseSavedFilterQuery(filter).saved),
    saved: filters.filter((filter) => parseSavedFilterQuery(filter).saved),
  };
}
