"use client";

import { useCallback, useEffect, useState } from "react";
import type { ListFilterCriteria } from "@/entities/saved-filter/list-query-schema";
import type { TaskFilterCriteria } from "@/entities/saved-filter/query-schema";
import type { SavedFilter, SavedFilterScope } from "@/entities/saved-filter/schema";

const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const NETWORK_ERROR_MESSAGE = "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";
const VALIDATION_ERROR_MESSAGE = "Проверьте правильность заполнения фильтра";
const NOT_FOUND_MESSAGE = "Фильтр не найден или уже удалён";

interface SavedFilterGroups {
  recent: SavedFilter[];
  saved: SavedFilter[];
}

export interface UseSavedFiltersResult<TCriteria> {
  recent: SavedFilter[];
  saved: SavedFilter[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  applyFilter: (criteria: TCriteria) => Promise<SavedFilter | null>;
  saveFilter: (criteria: TCriteria, label: string | null) => Promise<SavedFilter | null>;
  touchFilter: (id: string) => Promise<SavedFilter | null>;
  deleteFilter: (id: string) => Promise<boolean>;
}

const EMPTY_GROUPS: SavedFilterGroups = { recent: [], saved: [] };

type FetchSavedFilterGroupsResult = { ok: true; data: SavedFilterGroups } | { ok: false; error: string };

/**
 * Plain (non-hook) fetch + response parsing, shared by the mount effect's
 * inline `load()` and the exported `refresh` callback so neither has to
 * duplicate the request/parsing logic. Deliberately does not touch state —
 * callers decide how (and whether) to apply the result.
 */
async function fetchSavedFilterGroups(scope: SavedFilterScope): Promise<FetchSavedFilterGroupsResult> {
  try {
    const response = await fetch(`/api/saved-filters?scope=${scope}`);
    if (response.status === 401) {
      return { ok: false, error: SESSION_EXPIRED_MESSAGE };
    }
    if (!response.ok) {
      return { ok: false, error: UNEXPECTED_ERROR_MESSAGE };
    }
    const json = (await response.json().catch(() => null)) as { data?: Partial<SavedFilterGroups> } | null;
    if (!json?.data) {
      return { ok: false, error: UNEXPECTED_ERROR_MESSAGE };
    }
    return { ok: true, data: { recent: json.data.recent ?? [], saved: json.data.saved ?? [] } };
  } catch {
    return { ok: false, error: NETWORK_ERROR_MESSAGE };
  }
}

/**
 * Generic over the scope's criteria shape: existing callers (Task filters)
 * keep calling useSavedFilters() with no arguments, unaffected — the scope
 * defaults to "tasks" and the wire format is byte-identical to before.
 * Passing scope="lists" (with TCriteria = ListFilterCriteria) is the only
 * new behaviour, reusing this same request/error-handling plumbing rather
 * than a second, parallel hook.
 */
export function useSavedFilters<TCriteria extends TaskFilterCriteria | ListFilterCriteria = TaskFilterCriteria>(
  scope: SavedFilterScope = "tasks",
): UseSavedFiltersResult<TCriteria> {
  const [groups, setGroups] = useState<SavedFilterGroups>(EMPTY_GROUPS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const result = await fetchSavedFilterGroups(scope);
    if (result.ok) {
      setGroups(result.data);
    } else {
      setError(result.error);
    }
  }, [scope]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      const result = await fetchSavedFilterGroups(scope);
      if (cancelled) {
        return;
      }

      if (result.ok) {
        setGroups(result.data);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [scope]);

  const post = useCallback(
    async (body: unknown): Promise<SavedFilter | null> => {
      setError(null);
      try {
        const response = await fetch("/api/saved-filters", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });

        if (response.status === 401) {
          setError(SESSION_EXPIRED_MESSAGE);
          return null;
        }
        if (response.status === 400) {
          setError(VALIDATION_ERROR_MESSAGE);
          return null;
        }
        if (response.status === 404) {
          setError(NOT_FOUND_MESSAGE);
          return null;
        }
        if (!response.ok) {
          setError(UNEXPECTED_ERROR_MESSAGE);
          return null;
        }

        const json = (await response.json().catch(() => null)) as { data?: SavedFilter } | null;
        if (!json?.data) {
          setError(UNEXPECTED_ERROR_MESSAGE);
          return null;
        }

        await refresh();
        return json.data;
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
        return null;
      }
    },
    [refresh],
  );

  const applyFilter = useCallback(
    (criteria: TCriteria) => post(scope === "tasks" ? { action: "apply", criteria } : { action: "apply", scope, criteria }),
    [post, scope],
  );

  const saveFilter = useCallback(
    (criteria: TCriteria, label: string | null) =>
      post(scope === "tasks" ? { action: "save", criteria, label } : { action: "save", scope, criteria, label }),
    [post, scope],
  );

  const touchFilter = useCallback((id: string) => post({ action: "touch", id }), [post]);

  const deleteFilter = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);
      try {
        const response = await fetch(`/api/saved-filters/${id}`, { method: "DELETE" });

        if (response.status === 401) {
          setError(SESSION_EXPIRED_MESSAGE);
          return false;
        }
        if (response.status === 404) {
          setError(NOT_FOUND_MESSAGE);
          return false;
        }
        if (!response.ok) {
          setError(UNEXPECTED_ERROR_MESSAGE);
          return false;
        }

        await refresh();
        return true;
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
        return false;
      }
    },
    [refresh],
  );

  return {
    recent: groups.recent,
    saved: groups.saved,
    isLoading,
    error,
    refresh,
    applyFilter,
    saveFilter,
    touchFilter,
    deleteFilter,
  };
}
