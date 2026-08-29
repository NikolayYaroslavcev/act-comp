"use client";

import { useCallback, useEffect, useState } from "react";
import type { TaskFilterCriteria } from "@/entities/saved-filter/query-schema";
import type { SavedFilter } from "@/entities/saved-filter/schema";

const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const NETWORK_ERROR_MESSAGE = "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";
const VALIDATION_ERROR_MESSAGE = "Проверьте правильность заполнения фильтра";
const NOT_FOUND_MESSAGE = "Фильтр не найден или уже удалён";

interface SavedFilterGroups {
  recent: SavedFilter[];
  saved: SavedFilter[];
}

export interface UseSavedFiltersResult {
  recent: SavedFilter[];
  saved: SavedFilter[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  applyFilter: (criteria: TaskFilterCriteria) => Promise<SavedFilter | null>;
  saveFilter: (criteria: TaskFilterCriteria, label: string | null) => Promise<SavedFilter | null>;
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
async function fetchSavedFilterGroups(): Promise<FetchSavedFilterGroupsResult> {
  try {
    const response = await fetch("/api/saved-filters?scope=tasks");
    if (response.status === 401) {
      return { ok: false, error: SESSION_EXPIRED_MESSAGE };
    }
    if (!response.ok) {
      return { ok: false, error: UNEXPECTED_ERROR_MESSAGE };
    }
    const json = (await response.json().catch(() => null)) as { data?: SavedFilterGroups } | null;
    if (!json?.data) {
      return { ok: false, error: UNEXPECTED_ERROR_MESSAGE };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, error: NETWORK_ERROR_MESSAGE };
  }
}

export function useSavedFilters(): UseSavedFiltersResult {
  const [groups, setGroups] = useState<SavedFilterGroups>(EMPTY_GROUPS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await fetchSavedFilterGroups();
    if (result.ok) {
      setGroups(result.data);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      const result = await fetchSavedFilterGroups();
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
  }, []);

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

  const applyFilter = useCallback((criteria: TaskFilterCriteria) => post({ action: "apply", criteria }), [post]);

  const saveFilter = useCallback(
    (criteria: TaskFilterCriteria, label: string | null) => post({ action: "save", criteria, label }),
    [post],
  );

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

  return { recent: groups.recent, saved: groups.saved, isLoading, error, refresh, applyFilter, saveFilter, deleteFilter };
}
