"use client";

import { useCallback, useRef, useState } from "react";
import { baseApi } from "@/shared/api/base-api";
import { useAppDispatch } from "@/shared/store/hooks";

const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова";
const NETWORK_ERROR_MESSAGE =
  "Не удалось соединиться с сервером. Проверьте подключение к интернету";
const UNEXPECTED_ERROR_MESSAGE = "Что-то пошло не так. Попробуйте ещё раз";

export interface UseLogoutAllResult {
  logoutAll: () => Promise<boolean>;
  isPending: boolean;
  error: string | null;
}

export function useLogoutAll(): UseLogoutAllResult {
  const dispatch = useAppDispatch();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPendingRef = useRef(false);

  const logoutAll = useCallback(async (): Promise<boolean> => {
    if (isPendingRef.current) {
      return false;
    }

    isPendingRef.current = true;
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout-all", { method: "POST" });

      if (response.status === 401) {
        setError(SESSION_EXPIRED_MESSAGE);
        return false;
      }

      if (!response.ok) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return false;
      }

      const json = (await response.json().catch(() => null)) as { data?: { success?: boolean } } | null;
      if (!json?.data?.success) {
        setError(UNEXPECTED_ERROR_MESSAGE);
        return false;
      }

      // Every cached query/mutation result is scoped to whoever was signed
      // in when it was fetched — clearing it here (rather than relying only
      // on the store being a fresh in-memory instance next page load) closes
      // the same-tab window where a next login could otherwise still see
      // the previous user's cached data before anything re-fetches.
      dispatch(baseApi.util.resetApiState());
      return true;
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
      return false;
    } finally {
      isPendingRef.current = false;
      setIsPending(false);
    }
  }, [dispatch]);

  return { logoutAll, isPending, error };
}
